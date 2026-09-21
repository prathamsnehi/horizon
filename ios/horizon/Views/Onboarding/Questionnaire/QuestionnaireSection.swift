//
//  QuestionnaireSection.swift
//  horizon
//
//  The four questions that build the profile and the frame they sit in.
//  Owns which step shows and which way it's moving; calls onFinished at the end.
//

import SwiftUI

struct QuestionnaireSection: View {
    @Bindable var model: OnboardingFlowScreenModel
    /// Fires when the user completes the last step — saving the profile
    /// and firing the first generation belong to the flow, not here.
    let onFinished: () -> Void

    @State private var movingForward = true

    var body: some View {
        VStack(spacing: 0) {
            TrailProgress(
                currentIndex: model.currentStep.rawValue,
                total: OnboardingFlowScreenModel.Step.allCases.count
            )
            .padding(.horizontal, 48)
            .padding(.top, 24)
            .padding(.bottom, 28)

            ScrollView(showsIndicators: false) {
                step
                    .padding(.bottom, 32)
            }
            .scrollDismissesKeyboard(.interactively)

            StepNavigation(
                title: model.currentStep.advanceTitle,
                isFirstStep: model.currentStep == .edge,
                isLastStep: model.currentStep == .ground,
                canAdvance: model.canAdvance,
                onBack: goBack,
                onNext: goNext
            )
            .padding(.horizontal, 28)
            .padding(.bottom, 12)
        }
    }

    private var step: some View {
        StepContent(model: model)
            .id(model.currentStep) // new identity per step → transition runs
            .transition(.asymmetric(
                insertion: .move(edge: movingForward ? .trailing : .leading).combined(with: .opacity),
                removal: .move(edge: movingForward ? .leading : .trailing).combined(with: .opacity)
            ))
            .padding(.horizontal, 28)
    }

    private func goNext() {
        guard model.canAdvance else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()

        guard let next = OnboardingFlowScreenModel.Step(rawValue: model.currentStep.rawValue + 1) else {
            onFinished()
            return
        }

        movingForward = true
        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) {
            model.currentStep = next
        }
    }

    private func goBack() {
        guard let previous = OnboardingFlowScreenModel.Step(rawValue: model.currentStep.rawValue - 1) else { return }
        movingForward = false
        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) {
            model.currentStep = previous
        }
    }
}

/// The current step's form.
private struct StepContent: View {
    @Bindable var model: OnboardingFlowScreenModel

    var body: some View {
        switch model.currentStep {
        case .edge: EdgeStep(model: model)
        case .howFar: HowFarStep(model: model)
        case .draw: DrawStep(model: model)
        case .ground: GroundStep(model: model)
        }
    }
}

// MARK: - Expedition trail progress

/// The journey metaphor rendered: one ● node per step on a hairline
/// trail. Passed nodes fill AppPrimary; the current node pulses.
private struct TrailProgress: View {
    let currentIndex: Int
    let total: Int

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<total, id: \.self) { index in
                TrailNode(
                    isPassed: index <= currentIndex,
                    isCurrent: index == currentIndex
                )

                if index < total - 1 {
                    TrailSegment(isFilled: index < currentIndex)
                }
            }
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.85), value: currentIndex)
        // Collapse the decorative nodes into a single spoken position.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(currentIndex + 1) of \(total)")
    }
}

private struct TrailNode: View {
    let isPassed: Bool
    let isCurrent: Bool

    var body: some View {
        Image(systemName: isPassed ? "circle.fill" : "circle")
            .font(.system(size: 9))
            .foregroundStyle(isPassed ? Color("AppPrimary") : Color("AppSecondaryText").opacity(0.4))
            .phaseAnimator([false, true]) { view, pulsing in
                view
                    .scaleEffect(isCurrent && pulsing ? 1.3 : 1)
                    .opacity(isCurrent && pulsing ? 0.75 : 1)
            } animation: { _ in
                .easeInOut(duration: 1.2)
            }
    }
}

private struct TrailSegment: View {
    let isFilled: Bool

    var body: some View {
        Rectangle()
            .fill(isFilled ? Color("AppPrimary") : Color("AppSecondaryText").opacity(0.22))
            .frame(height: 1)
            .frame(maxWidth: .infinity)
    }
}

// MARK: - Back / Next

private struct StepNavigation: View {
    let title: String
    let isFirstStep: Bool
    let isLastStep: Bool
    let canAdvance: Bool
    let onBack: () -> Void
    let onNext: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            if !isFirstStep {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                        .font(.headline)
                        .foregroundStyle(Color("AppPrimaryText"))
                        .padding(17)
                        .background(
                            Circle().strokeBorder(Color("AppSecondaryText").opacity(0.35), lineWidth: 1)
                        )
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel("Back")
            }

            Button(action: onNext) {
                HStack(spacing: 8) {
                    // The last step generates rather than advances — the
                    // sparkles mark it as the end of the flow.
                    if isLastStep {
                        Image(systemName: "sparkles")
                        Text(title)
                    } else {
                        Text(title)
                        Image(systemName: "arrow.right")
                    }
                }
                .primaryCapsule(isEnabled: canAdvance)
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(!canAdvance)
        }
        .animation(.easeInOut(duration: 0.2), value: isFirstStep)
    }
}

#Preview("Questionnaire") {
    @Previewable @State var model = OnboardingFlowScreenModel()
    ZStack {
        AmbientBackground()
        QuestionnaireSection(model: model, onFinished: {})
    }
}
