import SwiftUI

struct EngineStatusView: View {
    let status: EngineStatus

    var body: some View {
        HStack(spacing: 16) {
            statusIndicator(
                label: "Broker",
                isOn: status.broker.connected,
                detail: status.broker.label ?? status.broker.name ?? "N/A"
            )
            statusIndicator(
                label: "Market",
                isOn: status.market.isOpen,
                detail: status.market.isOpen ? "Open" : "Closed"
            )
            statusIndicator(
                label: "Engine",
                isOn: status.engine.running,
                detail: status.engine.running ? "Running" : "Stopped"
            )
        }
        .padding()
        .cardStyle()
    }

    private func statusIndicator(label: String, isOn: Bool, detail: String) -> some View {
        VStack(spacing: 6) {
            Circle()
                .fill(isOn ? Color.statusActive : Color.statusDanger)
                .frame(width: 12, height: 12)
                .shadow(color: isOn ? Color.statusActive.opacity(0.5) : .clear, radius: 4)

            Text(label)
                .font(.caption.bold())
                .foregroundStyle(.white)

            Text(detail)
                .font(.caption2)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }
}
