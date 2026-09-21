//
//  ConfettiBurstView.swift
//  horizon
//
//  The confetti burst for "I Did It" — the one exception to the no-one-shot
//  rule. CAEmitterLayer, so the particles simulate off the main thread.
//

import SwiftUI

struct ConfettiBurstView: View {
    static let duration: TimeInterval = 1.5

    /// Where the burst erupts from, as a fraction of the view size.
    /// Defaults to roughly where the "I Did It" button sits on screen.
    var origin: UnitPoint = UnitPoint(x: 0.5, y: 0.72)

    var body: some View {
        ConfettiEmitterRepresentable(origin: origin)
            .ignoresSafeArea()
            .allowsHitTesting(false)
    }
}

private struct ConfettiEmitterRepresentable: UIViewRepresentable {
    let origin: UnitPoint

    func makeUIView(context: Context) -> ConfettiEmitterUIView {
        let view = ConfettiEmitterUIView()
        view.backgroundColor = .clear
        view.isUserInteractionEnabled = false
        view.originFraction = CGPoint(x: origin.x, y: origin.y)
        return view
    }

    func updateUIView(_ uiView: ConfettiEmitterUIView, context: Context) {}
}

private final class ConfettiEmitterUIView: UIView {
    var originFraction = CGPoint(x: 0.5, y: 0.72)

    private var hasFired = false

    override class var layerClass: AnyClass { CAEmitterLayer.self }

    private var emitterLayer: CAEmitterLayer {
        layer as! CAEmitterLayer
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        emitterLayer.emitterPosition = CGPoint(
            x: bounds.width * originFraction.x,
            y: bounds.height * originFraction.y
        )
        fireIfReady()
    }

    /// Emits one burst: full birth rate for a beat, then zero so the
    /// already-born particles play out their lifetimes.
    private func fireIfReady() {
        guard !hasFired, bounds.width > 0 else { return }
        hasFired = true

        let emitter = emitterLayer
        emitter.emitterShape = .point
        // Without this the layer back-fills particles as if it had been
        // emitting since the layer was created — a screenful of confetti
        // on the first frame.
        emitter.beginTime = CACurrentMediaTime()
        emitter.emitterCells = Self.makeCells(displayScale: traitCollection.displayScale)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
            self?.emitterLayer.birthRate = 0
        }
    }

    // MARK: Cells

    /// One white base image, tinted per cell via `color`.
    private static let particleImage: CGImage? = {
        let size = CGSize(width: 10, height: 6.5)
        let image = UIGraphicsImageRenderer(size: size).image { _ in
            UIColor.white.setFill()
            UIBezierPath(
                roundedRect: CGRect(origin: .zero, size: size),
                cornerRadius: 1.5
            ).fill()
        }
        return image.cgImage
    }()

    private static func makeCells(displayScale: CGFloat) -> [CAEmitterCell] {
        let primary = UIColor(named: "AppPrimary") ?? .orange
        let palette: [UIColor] = [
            primary,
            primary.withAlphaComponent(0.7),
            .white,
            .orange,
            .yellow
        ]

        // Ranges are total spread: emitted value = mean ± range/2.
        return palette.map { color in
            let cell = CAEmitterCell()
            cell.contents = particleImage
            cell.color = color.cgColor
            cell.birthRate = 120 // × 5 cells × 0.15s ≈ 90 particles
            cell.lifetime = 1.25
            cell.lifetimeRange = 0.2
            cell.emissionLongitude = -.pi / 2 // mostly upward
            cell.emissionRange = .pi * 0.35
            cell.velocity = 835
            cell.velocityRange = 630
            cell.yAcceleration = 1900 // gravity
            cell.spinRange = 20
            // Contents are drawn at pixel size, so divide out the Retina
            // scale to land at 6–11pt-wide pieces.
            cell.scale = 0.85 / displayScale
            cell.scaleRange = 0.5 / displayScale
            cell.alphaSpeed = -0.8 // transparent by end of lifetime
            return cell
        }
    }
}
