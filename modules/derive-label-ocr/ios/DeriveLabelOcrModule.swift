import ExpoModulesCore
import Foundation

struct DeriveLabelOcrInput: Record {
  @Field var uri: String = ""
  @Field var evidenceId: String = ""
  @Field var captureSessionId: String = ""
  @Field var generation: Int = 0
  @Field var languages: [String] = []
  @Field var correctionEnabled: Bool = false
  var engineInput: [String: Any] {
    ["uri": uri, "evidenceId": evidenceId, "captureSessionId": captureSessionId,
      "generation": generation, "languages": languages, "correctionEnabled": correctionEnabled]
  }
}

struct DeriveLabelUploadInput: Record {
  @Field var uri: String = ""
  @Field var cropRegion: [Double] = [0, 0, 1, 1]
  @Field var evidenceId: String = ""
  @Field var captureSessionId: String = ""
  @Field var generation: Int = 0
  @Field var languages: [String] = []
  @Field var correctionEnabled: Bool = false
  var recognitionInput: [String: Any]? { evidenceId.isEmpty ? nil : ["evidenceId": evidenceId, "captureSessionId": captureSessionId,
    "generation": generation, "languages": languages, "correctionEnabled": false] }
}

public class DeriveLabelOcrModule: Module {
  private let recognitionQueue = DispatchQueue(label: "skin.derive.label-ocr", qos: .userInitiated)
  public func definition() -> ModuleDefinition {
    Name("DeriveLabelOcr")
    AsyncFunction("prepareUpload") { (input: DeriveLabelUploadInput, promise: Promise) in
      let uri = input.uri, cropRegion = input.cropRegion, recognitionInput = input.recognitionInput
      self.recognitionQueue.async { promise.resolve(DeriveLabelOcrEngine.prepareUpload(uri, cropRegion: cropRegion, recognitionInput: recognitionInput)) }
    }
    AsyncFunction("recognize") { (input: DeriveLabelOcrInput, promise: Promise) in
      let engineInput = input.engineInput
      self.recognitionQueue.async {
        // Serial queue bounds recognition concurrency. No requests leave this process.
        promise.resolve(DeriveLabelOcrEngine.recognize(engineInput))
      }
    }
  }
}
