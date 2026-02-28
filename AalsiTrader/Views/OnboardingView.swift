import SwiftUI

struct OnboardingView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var currentStep = 0

    private let steps: [(icon: String, title: String, description: String)] = [
        (
            "person.3.fill",
            "Meet Your AI Squad",
            "6 specialized AI agents work together to analyze markets, find opportunities, and manage risk."
        ),
        (
            "chart.line.uptrend.xyaxis",
            "Paper Trading",
            "Start with \u{20B9}10,00,000 virtual capital. Practice risk-free before going live."
        ),
        (
            "magnifyingglass.circle",
            "Smart Money Screener",
            "Scan 97+ stocks for institutional patterns \u{2013} BOS (Break of Structure) and CHoCH (Change of Character)."
        ),
        (
            "bolt.fill",
            "Nifty Scalper",
            "Automated options straddle/strangle engine with real-time delta hedging."
        ),
        (
            "message.fill",
            "Chat with Prime",
            "Ask Prime to find trades, analyze your portfolio, or check risk. Your AI trading assistant."
        ),
        (
            "building.columns",
            "Connect a Broker",
            "Link your Zerodha, Dhan, Motilal, AngelOne, or Upstox account to go live."
        )
    ]

    private var isLastStep: Bool {
        currentStep == steps.count - 1
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Page content
                    TabView(selection: $currentStep) {
                        ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                            onboardingPage(step: step)
                                .tag(index)
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .animation(.easeInOut(duration: 0.3), value: currentStep)

                    // Progress dots
                    HStack(spacing: 8) {
                        ForEach(0..<steps.count, id: \.self) { index in
                            Circle()
                                .fill(index == currentStep ? Color.accentCyan : Color.appBorder)
                                .frame(width: index == currentStep ? 10 : 7, height: index == currentStep ? 10 : 7)
                                .animation(.easeInOut(duration: 0.2), value: currentStep)
                        }
                    }
                    .padding(.bottom, 24)

                    // Action button
                    Button {
                        HapticService.selection()
                        if isLastStep {
                            dismiss()
                        } else {
                            withAnimation {
                                currentStep += 1
                            }
                        }
                    } label: {
                        Text(isLastStep ? "Get Started" : "Next")
                            .font(.headline)
                            .foregroundStyle(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.accentCyan)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 16)

                    // Step counter
                    Text("\(currentStep + 1) of \(steps.count)")
                        .font(.caption)
                        .foregroundStyle(Color.textMuted)
                        .padding(.bottom, 24)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Skip") {
                        dismiss()
                    }
                    .foregroundStyle(Color.accentCyan)
                }
            }
        }
    }

    // MARK: - Onboarding Page

    private func onboardingPage(step: (icon: String, title: String, description: String)) -> some View {
        VStack(spacing: 24) {
            Spacer()

            // Icon with glow background
            ZStack {
                Circle()
                    .fill(Color.accentCyan.opacity(0.1))
                    .frame(width: 120, height: 120)

                Circle()
                    .fill(Color.accentCyan.opacity(0.05))
                    .frame(width: 160, height: 160)

                Image(systemName: step.icon)
                    .font(.system(size: 48, weight: .medium))
                    .foregroundStyle(Color.accentCyan)
            }

            // Title
            Text(step.title)
                .font(.title2.bold())
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)

            // Description
            Text(step.description)
                .font(.body)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.horizontal, 32)

            Spacer()
            Spacer()
        }
        .padding()
    }
}
