import ExpoModulesCore
import Foundation

public class DeriveLabelOcrModule: Module {
  private let recognitionQueue = DispatchQueue(label: "skin.derive.label-ocr", qos: .userInitiated)
  public func definition() -> ModuleDefinition {
    Name("DeriveLabelOcr")
    AsyncFunction("recognize") { (input: [String: Any], promise: Promise) in
      self.recognitionQueue.async {
        // Serial queue bounds recognition concurrency. No requests leave this process.
        promise.resolve(DeriveLabelOcrEngine.recognize(input))
      }
    }
  }
}
