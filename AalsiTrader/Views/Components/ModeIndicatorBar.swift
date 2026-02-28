import SwiftUI

struct ModeIndicatorBar: View {
    @Bindable var vm: PaperTradingViewModel
    @State private var showLiveConfirmation = false

    private var modeColor: Color {
        vm.isLiveMode ? Color.statusWarning : Color.accentCyan
    }

    private var modeLabel: String {
        vm.isLiveMode ? "LIVE MODE" : "PAPER MODE"
    }

    var body: some View {
        VStack(spacing: 8) {
            // Mode badge + toggle
            HStack(spacing: 10) {
                // Mode badge
                HStack(spacing: 5) {
                    Circle()
                        .fill(modeColor)
                        .frame(width: 6, height: 6)
                    Text(modeLabel)
                        .font(.caption2.bold())
                        .foregroundStyle(modeColor)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(modeColor.opacity(0.12))
                .clipShape(Capsule())

                Spacer()

                // Mode toggle
                Toggle(isOn: Binding(
                    get: { vm.isLiveMode },
                    set: { newValue in
                        if newValue {
                            showLiveConfirmation = true
                        } else {
                            Task { await vm.setMode("paper") }
                        }
                    }
                )) {
                    Text("Live")
                        .font(.caption2)
                        .foregroundStyle(Color.textSecondary)
                }
                .toggleStyle(.switch)
                .tint(Color.statusWarning)
                .fixedSize()
            }

            // Auto-trading + Sigma toggles
            HStack(spacing: 12) {
                // Auto-trading toggle
                HStack(spacing: 6) {
                    Image(systemName: "bolt.fill")
                        .font(.caption2)
                        .foregroundStyle(vm.autoTradingEnabled ? Color.profitGreen : Color.textMuted)
                    Text("Auto-Trade")
                        .font(.caption2)
                        .foregroundStyle(Color.textSecondary)

                    Toggle(isOn: Binding(
                        get: { vm.autoTradingEnabled },
                        set: { _ in Task { await vm.toggleAutoTrading() } }
                    )) {
                        EmptyView()
                    }
                    .toggleStyle(.switch)
                    .tint(Color.profitGreen)
                    .scaleEffect(0.8)
                    .fixedSize()
                }

                Divider()
                    .frame(height: 16)
                    .overlay(Color.appBorder)

                // Sigma Approval toggle
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.shield.fill")
                        .font(.caption2)
                        .foregroundStyle(vm.requireSigmaApproval ? Color.sigmaGreen : Color.textMuted)
                    Text("Sigma Approval")
                        .font(.caption2)
                        .foregroundStyle(Color.textSecondary)

                    Toggle(isOn: Binding(
                        get: { vm.requireSigmaApproval },
                        set: { _ in Task { await vm.toggleSigmaApproval() } }
                    )) {
                        EmptyView()
                    }
                    .toggleStyle(.switch)
                    .tint(Color.sigmaGreen)
                    .scaleEffect(0.8)
                    .fixedSize()
                }
            }
        }
        .padding(12)
        .cardStyle()
        .alert("Switch to Live Mode?", isPresented: $showLiveConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Enable Live Mode", role: .destructive) {
                Task { await vm.setMode("live") }
            }
        } message: {
            Text("Live mode will execute real trades with your connected broker. Make sure your broker credentials are configured and you understand the risks.")
        }
    }
}
