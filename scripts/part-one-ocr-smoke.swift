import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers
import Vision

@main struct PartOneOcrSmoke {
  static func require(_ condition: @autoclosure () -> Bool, _ name: String) throws {
    if !condition() { throw NSError(domain: "PartOneOcrSmoke", code: 1, userInfo: [NSLocalizedDescriptionKey: name]) }
  }
  static func hasJpegApplicationOrCommentSegments(_ data: Data) -> Bool {
    let bytes = [UInt8](data); var cursor = 2
    while cursor + 3 < bytes.count {
      guard bytes[cursor] == 0xff else { return true }
      while cursor < bytes.count && bytes[cursor] == 0xff { cursor += 1 }
      guard cursor < bytes.count else { return true }
      let marker = bytes[cursor]; cursor += 1
      if marker == 0xda || marker == 0xd9 { return false }
      if (0xe0...0xef).contains(marker) || marker == 0xfe { return true }
      guard cursor + 1 < bytes.count else { return true }
      cursor += Int(bytes[cursor]) * 256 + Int(bytes[cursor + 1])
    }
    return true
  }
  static func main() throws {
    #if targetEnvironment(simulator)
    let platform = "iOS-Simulator-Apple-Vision"
    #else
    let platform = "macOS-Apple-Vision"
    #endif
    let directory = CommandLine.arguments[1]
    let context = CGContext(data: nil, width: 5120, height: 1280, bitsPerComponent: 8, bytesPerRow: 0,
      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: 5120, height: 1280))
    let font = CTFontCreateWithName("Helvetica" as CFString, 120, nil)
    let text = NSAttributedString(string: "INGREDIENTS: Water, Glycerin, 1,2-Hexanediol.",
      attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(gray: 0, alpha: 1)])
    context.textPosition = CGPoint(x: 150, y: 700); CTLineDraw(CTLineCreateWithAttributedString(text), context)
    let image = context.makeImage()!
    // Managed cache uses opaque .img filenames, not user/library names. Verify content sniffing.
    let sourceUrl = URL(fileURLWithPath: directory).appendingPathComponent("synthetic-gps-label.img")
    guard let destination = CGImageDestinationCreateWithURL(sourceUrl as CFURL, UTType.heic.identifier as CFString, 1, nil) else {
      throw NSError(domain: "PartOneOcrSmoke", code: 2, userInfo: [NSLocalizedDescriptionKey: "HEIC fixture encoder unavailable"])
    }
    CGImageDestinationAddImage(destination, image, [
      kCGImagePropertyGPSDictionary: [kCGImagePropertyGPSLatitude: 1.25, kCGImagePropertyGPSLatitudeRef: "N",
        kCGImagePropertyGPSLongitude: 2.5, kCGImagePropertyGPSLongitudeRef: "E"],
      kCGImagePropertyExifDictionary: [kCGImagePropertyExifUserComment: "synthetic fixture only"],
      kCGImagePropertyOrientation: 1
    ] as CFDictionary)
    try require(CGImageDestinationFinalize(destination), "HEIC fixture write")
    let source = CGImageSourceCreateWithURL(sourceUrl as CFURL, nil)!
    let original = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)! as NSDictionary
    try require(original[kCGImagePropertyGPSDictionary] != nil, "GPS source fixture must actually contain GPS")
    let (derivative, width, height, transform) = DeriveLabelOcrEngine.localImage(sourceUrl.absoluteString)!
    try require(width == 5120 && height == 1280, "Original dimensions retained")
    try require(max(derivative.width, derivative.height) <= 4096, "4096 derivative cap")
    try require(transform == [1, 0, 0, 0, 1, 0, 0, 0, 1], "Orientation transform retained")
    let sanitized = DeriveLabelOcrEngine.sanitizedJpeg(derivative)!
    let cleaned = CGImageSourceCreateWithData(sanitized as CFData, nil)!
    let metadata = CGImageSourceCopyPropertiesAtIndex(cleaned, 0, nil)! as NSDictionary
    try require(metadata[kCGImagePropertyGPSDictionary] == nil, "GPS removed")
    try require(metadata[kCGImagePropertyExifDictionary] == nil, "EXIF removed")
    try require(metadata[kCGImagePropertyExifAuxDictionary] == nil, "Aux EXIF removed")
    try require(CGImageSourceGetCount(cleaned) == 1, "No secondary image")
    // ImageIO may generate a thumbnail even with creation flags false. Inspect the actual
    // JPEG segments instead: JFIF/EXIF/IPTC thumbnails cannot remain without APP segments.
    try require(!hasJpegApplicationOrCommentSegments(sanitized), "No embedded metadata or thumbnail segments")
    let upload = DeriveLabelOcrEngine.prepareUpload(sourceUrl.absoluteString, cropRegion: [0, 0, 1, 1])
    try require(upload["status"] as? String == "prepared", "Native upload derivative prepared")
    let uploadBytes = Data(base64Encoded: upload["base64"] as! String)!
    try require(uploadBytes.count <= 2 * 1024 * 1024, "Upload derivative byte cap")
    try require(!hasJpegApplicationOrCommentSegments(uploadBytes), "Upload derivative metadata stripped")
    let uploadImage = CGImageSourceCreateWithData(uploadBytes as CFData, nil)!
    try require(CGImageSourceCreateImageAtIndex(uploadImage, 0, nil) != nil, "Actual upload JPEG decodes")
    let uploadProperties = CGImageSourceCopyPropertiesAtIndex(uploadImage, 0, nil)! as NSDictionary
    try require(uploadProperties[kCGImagePropertyGPSDictionary] == nil && uploadProperties[kCGImagePropertyExifDictionary] == nil, "Upload GPS and EXIF removed")
    try require(upload["width"] as? Int == 4096 && upload["height"] as? Int == 1024, "Upload actual dimensions retained")
    let croppedUpload = DeriveLabelOcrEngine.prepareUpload(sourceUrl.absoluteString, cropRegion: [0.1, 0.1, 0.8, 0.8])
    try require(croppedUpload["status"] as? String == "prepared" && (croppedUpload["width"] as! Int) < 4096, "Explicit crop applied locally")
    try require(DeriveLabelOcrEngine.prepareUpload("https://example.com/never-fetched.jpg", cropRegion: [0, 0, 1, 1])["status"] as? String == "failed", "Upload refuses remote original")
    let input: [String: Any] = ["uri": sourceUrl.absoluteString, "evidenceId": "00000000-0000-4000-8000-000000000001",
      "captureSessionId": "00000000-0000-4000-8000-000000000002", "generation": Double(1),
      "languages": ["en-US"], "correctionEnabled": false]
    let start = Date(); let observation = DeriveLabelOcrEngine.recognize(input)
    try require(observation["status"] as? String == "recognized", "Local Vision synthetic text recognition")
    try require(observation["generation"] as? Int == 1, "JavaScript numeric nonzero generation retained")
    try require(observation["correctionEnabled"] as? Bool == false, "Correction disabled")
    try require(observation["sourceWidth"] as? Int == 5120, "Observation source dimensions")
    let lines = observation["lines"] as! [[String: Any]]
    try require(!lines.isEmpty, "Attributed lines retained")
    try require(lines.contains { ($0["text"] as? String)?.contains("1,2-Hexanediol") == true }, "Chemical punctuation retained")
    for line in lines {
      let region = line["region"] as! [Double]
      try require(region.count == 4 && region.allSatisfy { $0 >= 0 && $0 <= 1 }, "Normalized top-left region")
      try require(line["alternatives"] is [String], "Recognition alternatives retained")
    }
    var unsupported = input; unsupported["languages"] = ["unsupported-fixture-script"]
    try require(DeriveLabelOcrEngine.recognize(unsupported)["status"] as? String == "unsupported_script", "Unsupported script distinct")
    var remote = input; remote["uri"] = "https://example.com/never-fetched.jpg"
    try require(DeriveLabelOcrEngine.recognize(remote)["status"] as? String == "failed", "Remote URL refused")
    let receipt: [String: Any] = ["suite": "Part1-local-native-OCR", "fixtureVersion": "synthetic-heic-v1",
      "platform": platform, "osVersion": ProcessInfo.processInfo.operatingSystemVersionString,
      "visionRequestRevision": VNRecognizeTextRequest.currentRevision, "syntheticOnly": true,
      "recognized": true, "uploadJpegDecoded": true, "uploadDerivativeMetadataRemoved": true, "uploadByteCap": true, "explicitCropApplied": true, "nonzeroGenerationRetained": true, "gpsRemoved": true, "exifRemoved": true, "thumbnailRemoved": true,
      "longEdge": max(derivative.width, derivative.height), "elapsedMs": Int(Date().timeIntervalSince(start) * 1000),
      "timingScope": "single synthetic core run; no camera or device cohort", "physicalDeviceAcceptance": "unrun",
      "expoBridgeBuild": "separate-gate"]
    print(String(data: try JSONSerialization.data(withJSONObject: receipt, options: [.sortedKeys]), encoding: .utf8)!)
    try FileManager.default.removeItem(at: sourceUrl)
  }
}
