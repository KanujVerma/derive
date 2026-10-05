import Foundation
import CoreGraphics
import CoreText

/// Generated, authorized synthetic label corpus. No real product photo or private profile.
@main struct PrivateFixture {
  static func main() throws {
    let directory = CommandLine.arguments[1]
    let variant = ["Example", "Daily", "toner", "unscented", "clear", "not applicable", "standard", "100", "ml", "1", "each", "US", "Cosmetic", "3606000537538"]
    let ingredients = ["Ingredients: 1,2-Hexanediol, Aqua (Water, Eau), PPG-6-Decyltetradeceth-30, PEG-240/HDI Copolymer"]
    for (name, lines) in [("ingredients", ingredients), ("package", variant), ("ingredients-owner-b", ["Ingredients: Water, Glycerin"])] {
      let width = 1280, height = 1440
      guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { throw NSError(domain: "fixture", code: 1) }
      context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: width, height: height))
      for (index, text) in lines.enumerated() {
        let font = CTFontCreateWithName("Helvetica" as CFString, name.hasPrefix("ingredients") ? 20 : 32, nil)
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font,
          NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(gray: 0, alpha: 1)]))
        context.textPosition = CGPoint(x: Double(width) * 0.1, y: Double(height) * (1 - Double(index)/20) - 42)
        CTLineDraw(line, context)
      }
      guard let image = context.makeImage(), let jpeg = DeriveLabelOcrEngine.sanitizedJpeg(image) else { throw NSError(domain: "fixture", code: 2) }
      try jpeg.write(to: URL(fileURLWithPath: directory).appendingPathComponent("\(name).jpg"), options: .atomic)
    }
    print("Three synthetic metadata-free label JPEGs generated; fixed text and geometry.")
  }
}
