import UIKit
import AVFoundation
import Vision
import ExpoModulesCore

public class DeriveFaceCaptureView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate, AVCapturePhotoCaptureDelegate {
  private let captureSession = AVCaptureSession()
  private let videoOutput = AVCaptureVideoDataOutput()
  private let photoOutput = AVCapturePhotoOutput()
  private var previewLayer: AVCaptureVideoPreviewLayer?

  private let sessionQueue = DispatchQueue(label: "derive.face.sessionQueue")
  private let analysisQueue = DispatchQueue(label: "derive.face.analysisQueue")

  private var isSessionConfigured = false
  private var lastAnalysisTimestamp: CFTimeInterval = 0
  private let analysisThrottleInterval: CFTimeInterval = 0.12 // ~8 Hz

  private var pendingPhotoPromise: Promise?

  let onFrameMetrics = EventDispatcher()
  let onPhotoCaptured = EventDispatcher()

  private var targetAngle: String = "front"
  private var isActive: Bool = true

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    setupView()
  }

  private func setupView() {
    backgroundColor = .black
    configureSession()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer?.frame = bounds
  }

  public func setTargetAngle(_ angle: String) {
    self.targetAngle = angle
  }

  public func setIsActive(_ active: Bool) {
    self.isActive = active
    sessionQueue.async { [weak self] in
      guard let self = self else { return }
      if active && !self.captureSession.isRunning {
        self.captureSession.startRunning()
      } else if !active && self.captureSession.isRunning {
        self.captureSession.stopRunning()
      }
    }
  }

  private func configureSession() {
    sessionQueue.async { [weak self] in
      guard let self = self else { return }
      if self.isSessionConfigured { return }

      self.captureSession.beginConfiguration()
      self.captureSession.sessionPreset = .high

      // Add front-facing camera
      guard let frontCamera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
            let videoInput = try? AVCaptureDeviceInput(device: frontCamera),
            self.captureSession.canAddInput(videoInput) else {
        self.captureSession.commitConfiguration()
        return
      }
      self.captureSession.addInput(videoInput)

      // Add video data output for Vision frame analysis
      self.videoOutput.alwaysDiscardsLateVideoFrames = true
      self.videoOutput.videoSettings = [
        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)
      ]
      self.videoOutput.setSampleBufferDelegate(self, queue: self.analysisQueue)

      if self.captureSession.canAddOutput(self.videoOutput) {
        self.captureSession.addOutput(self.videoOutput)
        if let connection = self.videoOutput.connection(with: .video) {
          connection.videoOrientation = .portrait
          connection.isVideoMirrored = true
        }
      }

      // Add photo output for still captures
      if self.captureSession.canAddOutput(self.photoOutput) {
        self.captureSession.addOutput(self.photoOutput)
      }

      self.captureSession.commitConfiguration()
      self.isSessionConfigured = true

      DispatchQueue.main.async {
        let layer = AVCaptureVideoPreviewLayer(session: self.captureSession)
        layer.videoGravity = .resizeAspectFill
        layer.frame = self.bounds
        self.layer.addSublayer(layer)
        self.previewLayer = layer
      }

      if self.isActive {
        self.captureSession.startRunning()
      }
    }
  }

  // MARK: - AVCaptureVideoDataOutputSampleBufferDelegate
  public func captureOutput(
    _ output: AVCaptureOutput,
    didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    let now = CACurrentMediaTime()
    guard now - lastAnalysisTimestamp >= analysisThrottleInterval else {
      return
    }
    lastAnalysisTimestamp = now

    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
      return
    }

    // Vision face rectangles request for pose & bounding box
    let faceRectRequest = VNDetectFaceRectanglesRequest()
    let faceQualityRequest = VNDetectFaceCaptureQualityRequest()

    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])

    do {
      try handler.perform([faceRectRequest, faceQualityRequest])

      guard let results = faceRectRequest.results, let face = results.first else {
        // No face detected in frame
        DispatchQueue.main.async { [weak self] in
          self?.onFrameMetrics([
            "hasFace": false
          ])
        }
        return
      }

      let bbox = face.boundingBox
      let centerX = bbox.midX
      let centerY = 1.0 - bbox.midY // Flip Y to match standard UI coordinate space
      let faceWidthRatio = bbox.width

      // Angles in degrees
      let yaw = face.yaw?.doubleValue != nil ? (face.yaw!.doubleValue * 180.0 / .pi) : 0.0
      let roll = face.roll?.doubleValue != nil ? (face.roll!.doubleValue * 180.0 / .pi) : 0.0
      let pitch = face.pitch?.doubleValue != nil ? (face.pitch!.doubleValue * 180.0 / .pi) : 0.0

      var quality = 0.5
      if let qualityResults = faceQualityRequest.results, let qFace = qualityResults.first {
        quality = Double(qFace.faceCaptureQuality ?? 0.5)
      }

      DispatchQueue.main.async { [weak self] in
        self?.onFrameMetrics([
          "hasFace": true,
          "yaw": yaw,
          "roll": roll,
          "pitch": pitch,
          "centerX": centerX,
          "centerY": centerY,
          "faceWidthRatio": faceWidthRatio,
          "captureQuality": quality
        ])
      }
    } catch {
      // Vision request failed gracefully
    }
  }

  // MARK: - Photo Capture
  public func takePhoto(promise: Promise) {
    self.pendingPhotoPromise = promise
    let settings = AVCapturePhotoSettings()
    photoOutput.capturePhoto(with: settings, delegate: self)
  }

  public func photoOutput(
    _ output: AVCapturePhotoOutput,
    didFinishProcessingPhoto photo: AVCapturePhoto,
    error: Error?
  ) {
    if let error = error {
      pendingPhotoPromise?.reject("CAPTURE_FAILED", error.localizedDescription)
      pendingPhotoPromise = nil
      return
    }

    guard let photoData = photo.fileDataRepresentation() else {
      pendingPhotoPromise?.reject("NO_DATA", "Failed to retrieve photo file data")
      pendingPhotoPromise = nil
      return
    }

    let fileName = "derive_face_\(UUID().uuidString).jpg"
    let tempDir = FileManager.default.temporaryDirectory
    let fileURL = tempDir.appendingPathComponent(fileName)

    do {
      try photoData.write(to: fileURL)
      let uriString = fileURL.absoluteString

      pendingPhotoPromise?.resolve(["uri": uriString])
      pendingPhotoPromise = nil

      onPhotoCaptured(["uri": uriString])
    } catch {
      pendingPhotoPromise?.reject("WRITE_FAILED", error.localizedDescription)
      pendingPhotoPromise = nil
    }
  }

  deinit {
    if captureSession.isRunning {
      captureSession.stopRunning()
    }
  }
}
