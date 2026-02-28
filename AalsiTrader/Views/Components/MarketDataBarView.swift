import SwiftUI

struct MarketDataBarView: View {
    @State private var vm = MarketDataViewModel()

    var body: some View {
        VStack(spacing: 0) {
            if vm.isLoading && vm.indices.isEmpty {
                HStack {
                    ProgressView()
                        .tint(Color.accentCyan)
                    Text("Loading market data...")
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(Color.cardBackground)
            } else if vm.indices.isEmpty {
                EmptyView()
            } else {
                HStack(spacing: 8) {
                    ForEach(vm.indices) { index in
                        MarketIndexCard(index: index)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.cardBackground)
            }
        }
        .task {
            vm.startPolling()
        }
        .onDisappear {
            vm.stopPolling()
        }
    }
}

// MARK: - Index Card

private struct MarketIndexCard: View {
    let index: MarketIndex

    private var isPositive: Bool {
        index.change >= 0
    }

    private var changeColor: Color {
        isPositive ? Color.profitGreen : Color.lossRed
    }

    private var arrowIcon: String {
        isPositive ? "arrow.up.right" : "arrow.down.right"
    }

    private var displayName: String {
        switch index.name.lowercased() {
        case let n where n.contains("nifty 50"), let n where n.contains("nifty50"):
            return "Nifty 50"
        case let n where n.contains("bank"):
            return "Bank Nifty"
        case let n where n.contains("sensex"):
            return "Sensex"
        default:
            return index.name
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(displayName)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(Color.textSecondary)
                .lineLimit(1)

            Text(formatPrice(index.value))
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            HStack(spacing: 2) {
                Image(systemName: arrowIcon)
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(changeColor)

                Text(formatChange(index.change))
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .foregroundStyle(changeColor)

                Text("(\(formatPercent(index.changePercent)))")
                    .font(.system(size: 8, weight: .medium, design: .monospaced))
                    .foregroundStyle(changeColor)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(changeColor.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(changeColor.opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Formatting

    private func formatPrice(_ value: Double) -> String {
        if value >= 10000 {
            return String(format: "%.0f", value)
        }
        return String(format: "%.1f", value)
    }

    private func formatChange(_ value: Double) -> String {
        let sign = value >= 0 ? "+" : ""
        if abs(value) >= 100 {
            return String(format: "%@%.0f", sign, value)
        }
        return String(format: "%@%.1f", sign, value)
    }

    private func formatPercent(_ value: Double) -> String {
        let sign = value >= 0 ? "+" : ""
        return String(format: "%@%.2f%%", sign, value)
    }
}
