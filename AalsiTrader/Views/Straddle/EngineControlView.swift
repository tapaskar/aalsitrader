import SwiftUI

struct EngineControlView: View {
    let status: EngineStatus
    let isPerforming: Bool
    let onStart: () -> Void
    let onStop: () -> Void
    let onSetMode: (TradingMode) -> Void

    @State private var showLiveConfirm = false

    var body: some View {
        VStack(spacing: 12) {
            // Start/Stop button
            Button {
                if status.engine.running {
                    onStop()
                } else {
                    onStart()
                }
            } label: {
                HStack {
                    if isPerforming {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: status.engine.running ? "stop.fill" : "play.fill")
                    }
                    Text(status.engine.running ? "Stop Engine" : "Start Engine")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .tint(status.engine.running ? Color.statusDanger : Color.profitGreen)
            .disabled(isPerforming)

            // Mode toggle
            HStack(spacing: 12) {
                Text("Mode:")
                    .font(.subheadline)
                    .foregroundStyle(Color.textSecondary)

                Picker("Mode", selection: Binding(
                    get: { status.engine.mode ?? .paper },
                    set: { newMode in
                        if newMode == .live {
                            showLiveConfirm = true
                        } else {
                            onSetMode(newMode)
                        }
                    }
                )) {
                    Text("Paper").tag(TradingMode.paper)
                    Text("Live").tag(TradingMode.live)
                }
                .pickerStyle(.segmented)
            }

            // Engine details
            HStack(spacing: 16) {
                if let index = status.engine.indexName {
                    detailChip("Index", index.rawValue)
                }
                if let strategy = status.engine.strategyType {
                    detailChip("Strategy", strategy.displayName)
                }
                if let spot = status.engine.lastSpot {
                    detailChip("Spot", "₹" + String(format: "%.1f", spot))
                }
            }
        }
        .padding()
        .cardStyle()
        .alert("Switch to Live Mode?", isPresented: $showLiveConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Switch to Live", role: .destructive) {
                onSetMode(.live)
            }
        } message: {
            Text("This will use real money with your broker. Make sure your broker is connected and you understand the risks.")
        }
    }

    private func detailChip(_ label: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(Color.textMuted)
            Text(value)
                .font(.caption.bold())
                .foregroundStyle(.white)
        }
    }
}
