// Render the existing onboarding vector mark as native launcher/splash assets.
// Run from expo/: swift -module-cache-path /private/tmp/frame-swift-cache scripts/render-brand-assets.swift
// Geometry: Fullscreen by Andrejs Kirma, Noun Project; supplied by the project owner.
import AppKit

let mineralBlue = NSColor(srgbRed: 59 / 255, green: 96 / 255, blue: 115 / 255, alpha: 1)
let bone = NSColor(srgbRed: 243 / 255, green: 240 / 255, blue: 234 / 255, alpha: 1)

func render(_ filename: String, pixels: Int, markSize: CGFloat, background: Bool) throws {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    let context = NSGraphicsContext(bitmapImageRep: bitmap)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.shouldAntialias = true
    if background {
        bone.setFill()
        NSBezierPath(rect: NSRect(x: 0, y: 0, width: pixels, height: pixels)).fill()
    }
    let origin = (CGFloat(pixels) - markSize) / 2
    let unit = markSize / 20
    mineralBlue.setFill()
    // The same four 7 × 7 corners, with 3-unit strokes, used in OnboardingIdentity.
    for (x, y) in [(0, 0), (13, 0), (0, 13), (13, 13)] {
        let verticalX = x == 0 ? 0 : 17
        let horizontalY = y == 0 ? 0 : 17
        NSBezierPath(rect: NSRect(x: origin + CGFloat(verticalX) * unit, y: origin + CGFloat(y) * unit,
            width: 3 * unit, height: 7 * unit)).fill()
        NSBezierPath(rect: NSRect(x: origin + CGFloat(x) * unit, y: origin + CGFloat(horizontalY) * unit,
            width: 7 * unit, height: 3 * unit)).fill()
    }
    NSGraphicsContext.restoreGraphicsState()
    var output = bitmap
    if background {
        // Opaque app icons should have no alpha channel; adaptive/splash retain it.
        let opaque = CGContext(data: nil, width: pixels, height: pixels, bitsPerComponent: 8,
            bytesPerRow: pixels * 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
        opaque.draw(bitmap.cgImage!, in: CGRect(x: 0, y: 0, width: pixels, height: pixels))
        output = NSBitmapImageRep(cgImage: opaque.makeImage()!)
    }
    try output.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "assets/images/\(filename)"))
}

try render("icon.png", pixels: 1024, markSize: 560, background: true)
// Keep every corner inside the adaptive icon's central circular safe area.
try render("adaptive-icon.png", pixels: 1024, markSize: 432, background: false)
try render("splash-icon.png", pixels: 1024, markSize: 432, background: false)
try render("favicon.png", pixels: 48, markSize: 32, background: true)
try render("favicon-32.png", pixels: 32, markSize: 22, background: true)
