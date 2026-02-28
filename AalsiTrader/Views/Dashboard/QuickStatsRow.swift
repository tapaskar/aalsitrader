import SwiftUI

struct QuickStatsRow: View {
    let portfolio: PaperPortfolio

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                // Portfolio Value
                miniCard(
                    title: "Portfolio",
                    value: portfolio.capital.inrShort,
                    icon: "indianrupeesign.circle.fill",
                    color: .accentCyan
                )

                // Day P&L
                miniCard(
                    title: "Day P&L",
                    value: formatPnL(portfolio.dayPnl),
                    icon: "chart.line.uptrend.xyaxis",
                    color: portfolio.dayPnl >= 0 ? .profitGreen : .lossRed
                )

                // Open Positions
                miniCard(
                    title: "Open Positions",
                    value: "\(portfolio.openPositions)",
                    icon: "rectangle.stack.fill",
                    color: .betaTeal
                )

                // Win Rate
                miniCard(
                    title: "Win Rate",
                    value: String(format: "%.0f%%", portfolio.winRate),
                    icon: "target",
                    color: portfolio.winRate >= 50 ? .profitGreen : .statusWarning
                )
            }
            .padding(.horizontal)
        }
    }

    private func formatPnL(_ value: Double) -> String {
        let sign = value >= 0 ? "+" : ""
        return "\(sign)\(value.inrShort)"
    }

    private func miniCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption2)
                    .foregroundStyle(color.opacity(0.8))
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(Color.textSecondary)
            }

            Text(value)
                .font(.callout.bold())
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(width: 110, alignment: .leading)
        .padding(10)
        .background(color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(color.opacity(0.15), lineWidth: 1)
        )
    }
}
