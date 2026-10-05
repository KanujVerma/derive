import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

/// Authorized synthetic native-to-server geometry corpus. No real photos or profiles.
@main struct PrivateGeometryFixture {
  static func main() throws {
    let directory = URL(fileURLWithPath: CommandLine.arguments[1])
    let captureId = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "dc000000-0000-4000-8000-000000000001"
    let generation = CommandLine.arguments.count > 3 ? Int(CommandLine.arguments[3])! : 1
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    var summaries: [[String: Any]] = []
    for (index, configuration) in [("rotated", 1280, 640, 6), ("large", 5120, 1280, 1), ("large-rotated", 5120, 1280, 6)].enumerated() {
      let (name, uprightWidth, uprightHeight, orientation) = configuration
      let upright = CGContext(data: nil, width: uprightWidth, height: uprightHeight, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
      upright.setFillColor(CGColor(gray: 1, alpha: 1)); upright.fill(CGRect(x: 0, y: 0, width: uprightWidth, height: uprightHeight))
      let text = "Ingredients: Water, Glycerin, 1,2-Hexanediol."
      let font = CTFontCreateWithName("Helvetica" as CFString, CGFloat(uprightWidth) / 43, nil)
      let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(gray: 0, alpha: 1)]))
      upright.textPosition = CGPoint(x: CGFloat(uprightWidth) * 0.05, y: CGFloat(uprightHeight) * 0.5); CTLineDraw(line, upright)
      var image = upright.makeImage()!
      if orientation == 6 {
        let raw = CGContext(data: nil, width: uprightHeight, height: uprightWidth, bitsPerComponent: 8, bytesPerRow: 0,
          space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
        raw.translateBy(x: 0, y: CGFloat(uprightWidth)); raw.rotate(by: -.pi / 2)
        raw.draw(image, in: CGRect(x: 0, y: 0, width: uprightWidth, height: uprightHeight)); image = raw.makeImage()!
      }
      let source = directory.appendingPathComponent("\(name)-original.heic")
      guard let encoder = CGImageDestinationCreateWithURL(source as CFURL, UTType.heic.identifier as CFString, 1, nil) else { throw NSError(domain: "fixture", code: 1) }
      CGImageDestinationAddImage(encoder, image, [kCGImagePropertyOrientation: orientation] as CFDictionary)
      guard CGImageDestinationFinalize(encoder) else { throw NSError(domain: "fixture", code: 2) }
      let input: [String: Any] = ["uri": source.absoluteString, "evidenceId": String(format: "dc000000-0000-4000-8000-%012d", 10 + index),
        "captureSessionId": captureId, "generation": generation, "languages": ["en-US"], "correctionEnabled": false]
      let original = DeriveLabelOcrEngine.recognize(input)
      let upload = DeriveLabelOcrEngine.prepareUpload(source.absoluteString, cropRegion: [0, 0, 1, 1], recognitionInput: input)
      guard upload["status"] as? String == "prepared", let derivative = upload["derivativeObservation"] as? [String: Any],
        derivative["status"] as? String == "recognized", original["status"] as? String == "recognized",
        derivative["sourceWidth"] as? Int == upload["width"] as? Int, derivative["sourceHeight"] as? Int == upload["height"] as? Int,
        derivative["orientationTransform"] as? [Int] == [1, 0, 0, 0, 1, 0, 0, 0, 1],
        let jpeg = Data(base64Encoded: upload["base64"] as! String), let decoded = CGImageSourceCreateWithData(jpeg as CFData, nil),
        let actual = CGImageSourceCreateImageAtIndex(decoded, 0, nil), actual.width == derivative["sourceWidth"] as? Int,
        actual.height == derivative["sourceHeight"] as? Int else { throw NSError(domain: "fixture-geometry-\(name)", code: 3) }
      try jpeg.write(to: directory.appendingPathComponent("\(name)-sanitized.jpg"))
      let payload: [String: Any] = ["case": name, "sourceUri": source.absoluteString, "originalObservation": original, "prepared": upload]
      try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]).write(to: directory.appendingPathComponent("\(name).json"))
      summaries.append(["case": name, "originalWidth": original["sourceWidth"]!, "originalHeight": original["sourceHeight"]!,
        "originalTransform": original["orientationTransform"]!, "derivativeWidth": actual.width, "derivativeHeight": actual.height,
        "recognizedExactEncodedJpeg": true, "generation": generation])
    }
    print(String(data: try JSONSerialization.data(withJSONObject: ["syntheticOnly": true, "cases": summaries, "physicalCameraAcceptance": "unrun"], options: [.sortedKeys]), encoding: .utf8)!)
  }
}
