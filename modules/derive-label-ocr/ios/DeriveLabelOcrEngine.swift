import Foundation
import Vision
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

/// Local-only derivative/recognition core. Source URLs are never uploaded, logged or copied to backups.
enum DeriveLabelOcrEngine {
  static let maxLongEdge = 4096
  static let maxSourcePixels = 40_000_000
  static func orientationTransform(_ exif: Int) -> [Int] {
    switch exif {
    case 2: return [-1, 0, 1, 0, 1, 0, 0, 0, 1]
    case 3: return [-1, 0, 1, 0, -1, 1, 0, 0, 1]
    case 4: return [1, 0, 0, 0, -1, 1, 0, 0, 1]
    case 5: return [0, 1, 0, 1, 0, 0, 0, 0, 1]
    case 6: return [0, -1, 1, 1, 0, 0, 0, 0, 1]
    case 7: return [0, -1, 1, -1, 0, 1, 0, 0, 1]
    case 8: return [0, 1, 0, -1, 0, 1, 0, 0, 1]
    default: return [1, 0, 0, 0, 1, 0, 0, 0, 1]
    }
  }
  static func localImage(_ uri: String) -> (CGImage, Int, Int, [Int])? {
    guard let url = URL(string: uri), url.isFileURL,
      let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
      let size = attributes[.size] as? NSNumber, size.intValue <= 30 * 1024 * 1024,
      let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let width = properties[kCGImagePropertyPixelWidth] as? Int,
      let height = properties[kCGImagePropertyPixelHeight] as? Int,
      width > 0, height > 0, width <= maxSourcePixels / height,
      let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxLongEdge,
        kCGImageSourceShouldCacheImmediately: true
      ] as CFDictionary) else { return nil }
    return (image, width, height, orientationTransform(properties[kCGImagePropertyOrientation] as? Int ?? 1))
  }
  /// An evaluation-only memory derivative; no durable upload operation is enabled.
  static func sanitizedJpeg(_ image: CGImage) -> Data? {
    let data = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationEmbedThumbnail: false] as CFDictionary)
    // ImageIO can synthesize EXIF even with an empty metadata object. Strip encoder-created
    // JPEG application/comment segments and verify the resulting derivative by decoding it.
    guard CGImageDestinationFinalize(destination), let stripped = stripJpegMetadata(data as Data),
      let source = CGImageSourceCreateWithData(stripped as CFData, nil),
      let metadata = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      metadata[kCGImagePropertyGPSDictionary] == nil, metadata[kCGImagePropertyExifDictionary] == nil,
      metadata[kCGImagePropertyExifAuxDictionary] == nil,
      CGImageSourceGetCount(source) == 1 else { return nil }
    return stripped
  }
  static func stripJpegMetadata(_ data: Data) -> Data? {
    let bytes = [UInt8](data)
    guard bytes.count >= 4, bytes[0] == 0xff, bytes[1] == 0xd8 else { return nil }
    var output = Data(bytes[0...1]), cursor = 2
    while cursor < bytes.count {
      guard bytes[cursor] == 0xff else { return nil }
      let start = cursor
      while cursor < bytes.count && bytes[cursor] == 0xff { cursor += 1 }
      guard cursor < bytes.count else { return nil }
      let marker = bytes[cursor]; cursor += 1
      if marker == 0xda { output.append(contentsOf: bytes[start...]); return output }
      if marker == 0xd9 { output.append(contentsOf: bytes[start..<cursor]); return output }
      guard cursor + 1 < bytes.count else { return nil }
      let length = Int(bytes[cursor]) * 256 + Int(bytes[cursor + 1])
      guard length >= 2, cursor + length <= bytes.count else { return nil }
      if !(0xe0...0xef).contains(marker) && marker != 0xfe {
        output.append(contentsOf: bytes[start..<(cursor + length)])
      }
      cursor += length
    }
    return nil
  }
  static func recognitionErrorStatus(_ error: Error) -> String {
    let failure = error as NSError
    guard failure.domain == VNErrorDomain else { return "failed" }
    if failure.code == VNErrorCode.requestCancelled.rawValue { return "cancelled" }
    if failure.code == VNErrorCode.invalidModel.rawValue || failure.code == VNErrorCode.unsupportedRevision.rawValue ||
      failure.code == VNErrorCode.dataUnavailable.rawValue { return "model_unavailable" }
    return "failed"
  }
  static func recognize(_ input: [String: Any]) -> [String: Any] {
    let languages = input["languages"] as? [String] ?? []
    let correction = input["correctionEnabled"] as? Bool ?? false
    var result: [String: Any] = [
      "evidenceId": input["evidenceId"] as? String ?? "", "captureSessionId": input["captureSessionId"] as? String ?? "",
      "generation": (input["generation"] as? NSNumber)?.intValue ?? 0, "recognizer": "apple_vision",
      "recognizerVersion": "vision-revision-\(VNRecognizeTextRequest.currentRevision)-\(ProcessInfo.processInfo.operatingSystemVersionString)",
      "languageConfig": languages, "correctionEnabled": correction,
      "sourceWidth": 0, "sourceHeight": 0, "orientationTransform": orientationTransform(1), "lines": [], "status": "failed"
    ]
    guard let uri = input["uri"] as? String, let (image, width, height, transform) = localImage(uri) else { return result }
    result["sourceWidth"] = width; result["sourceHeight"] = height; result["orientationTransform"] = transform
    let request = VNRecognizeTextRequest()
    request.revision = VNRecognizeTextRequest.currentRevision
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = correction
    // customWords is never set: correction-off is the only release candidate in this evaluation.
    do {
      let supported = try request.supportedRecognitionLanguages()
      guard !languages.isEmpty, languages.allSatisfy({ supported.contains($0) }) else {
        result["status"] = "unsupported_script"; return result
      }
    } catch { result["status"] = "model_unavailable"; return result }
    request.recognitionLanguages = languages
    request.automaticallyDetectsLanguage = false
    do {
      try VNImageRequestHandler(cgImage: image, orientation: .up).perform([request])
      let lines: [[String: Any]] = (request.results ?? []).compactMap { observation in
        let candidates = observation.topCandidates(3)
        guard let top = candidates.first else { return nil }
        let box = observation.boundingBox
        return ["text": top.string, "alternatives": candidates.dropFirst().map { $0.string },
          "region": [Double(box.minX), Double(1 - box.maxY), Double(box.width), Double(box.height)], "confidence": Double(top.confidence)]
      }
      result["lines"] = lines; result["status"] = lines.isEmpty ? "no_text" : "recognized"
    } catch { result["status"] = recognitionErrorStatus(error) }
    return result
  }
}
