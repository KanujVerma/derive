import ExpoModulesCore

public class DeriveFaceCaptureModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DeriveFaceCapture")

    View(DeriveFaceCaptureView.self) {
      Events("onFrameMetrics", "onPhotoCaptured")

      Prop("targetAngle") { (view: DeriveFaceCaptureView, angle: String) in
        view.setTargetAngle(angle)
      }

      Prop("isActive") { (view: DeriveFaceCaptureView, active: Bool) in
        view.setIsActive(active)
      }

      AsyncFunction("takePhoto") { (view: DeriveFaceCaptureView, promise: Promise) in
        view.takePhoto(promise: promise)
      }
    }
  }
}
