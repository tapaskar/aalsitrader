import SwiftUI

struct PortfolioSummaryView: View {
    let portfolio: PaperPortfolio

    var body: some View {
        VStack(spacing: 12) {
            // Main capital card
            VStack(spacing: 4) {
                Text("Portfolio Value")
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary)
                Text(portfolio.capital.inrFormatted)
                    .font(.title.bold())
                    .foregroundStyle(.white)
                HStack(spacing: 8) {
                    PnLTextView(value: portfolio.totalPnl, font: .subheadline)
                    Text("(\(portfolio.totalPnl / max(portfolio.startingCapital, 1) * 100, specifier: "%.2f")%)")
                        .font(.caption)
                        .foregroundStyle(portfolio.totalPnl >= 0 ? Color.profitGreen : Color.lossRed)
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .cardStyle()

            // Stat cards grid
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                StatCardView(
                    title: "Day P&L",
                    value: portfolio.dayPnl.inrFormatted,
                    color: portfolio.dayPnl >= 0 ? Color.profitGreen : Color.lossRed,
                    icon: "sun.max"
                )
                StatCardView(
                    title: "Unrealized",
                    value: portfolio.unrealizedPnl.inrFormatted,
                    color: portfolio.unrealizedPnl >= 0 ? Color.profitGreen : Color.lossRed,
                    icon: "clock"
                )
                StatCardView(
                    title: "Margin Used",
                    value: portfolio.marginUsed.inrShort,
                    subtitle: "\(portfolio.openPositions) positions",
                    color: Color.statusWarning,
                    icon: "lock.shield"
                )
                StatCardView(
                    title: "Available",
                    value: portfolio.availableCapital.inrShort,
                    color: Color.accentCyan,
                    icon: "banknote"
                )
                StatCardView(
                    title: "Win Rate",
                    value: portfolio.winRate.pctFormatted,
                    color: portfolio.winRate >= 50 ? Color.profitGreen : Color.lossRed,
                    icon: "target"
                )
                StatCardView(
                    title: "Max Drawdown",
                    value: portfolio.maxDrawdown.pctFormatted,
                    color: Color.statusDanger,
                    icon: "arrow.down.right"
                )
            }
        }
    }
}
