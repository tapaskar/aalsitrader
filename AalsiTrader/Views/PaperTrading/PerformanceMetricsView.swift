import SwiftUI

struct PerformanceMetricsView: View {
    let metrics: PaperMetrics

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Performance")
                .sectionHeader()

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                StatCardView(
                    title: "Total Trades",
                    value: "\(metrics.totalTrades)",
                    subtitle: "\(metrics.winningTrades)W / \(metrics.losingTrades)L",
                    icon: "number"
                )
                StatCardView(
                    title: "Win Rate",
                    value: metrics.winRate.pctFormatted,
                    color: metrics.winRate >= 50 ? Color.profitGreen : Color.lossRed,
                    icon: "target"
                )
                StatCardView(
                    title: "Net P&L",
                    value: metrics.netPnL.inrShort,
                    color: metrics.netPnL >= 0 ? Color.profitGreen : Color.lossRed,
                    icon: "indianrupeesign"
                )
                StatCardView(
                    title: "Profit Factor",
                    value: String(format: "%.2f", metrics.profitFactor),
                    color: metrics.profitFactor >= 1 ? Color.profitGreen : Color.lossRed,
                    icon: "divide"
                )
                StatCardView(
                    title: "Avg Win",
                    value: metrics.avgWin.inrShort,
                    color: Color.profitGreen,
                    icon: "arrow.up"
                )
                StatCardView(
                    title: "Avg Loss",
                    value: metrics.avgLoss.inrShort,
                    color: Color.lossRed,
                    icon: "arrow.down"
                )
                StatCardView(
                    title: "Largest Win",
                    value: metrics.largestWin.inrShort,
                    color: Color.profitGreen,
                    icon: "star"
                )
                StatCardView(
                    title: "Largest Loss",
                    value: metrics.largestLoss.inrShort,
                    color: Color.lossRed,
                    icon: "exclamationmark.triangle"
                )
                StatCardView(
                    title: "Sharpe Ratio",
                    value: String(format: "%.2f", metrics.sharpeRatio),
                    color: metrics.sharpeRatio >= 1 ? Color.profitGreen : Color.statusWarning,
                    icon: "chart.line.uptrend.xyaxis"
                )
                StatCardView(
                    title: "Sortino Ratio",
                    value: String(format: "%.2f", metrics.sortinoRatio),
                    color: metrics.sortinoRatio >= 1 ? Color.profitGreen : Color.statusWarning,
                    icon: "chart.line.downtrend.xyaxis"
                )
                StatCardView(
                    title: "Max Drawdown",
                    value: metrics.maxDrawdown.pctFormatted,
                    color: Color.statusDanger,
                    icon: "arrow.down.right"
                )
                StatCardView(
                    title: "Total Return",
                    value: metrics.totalReturn.pctFormatted,
                    color: metrics.totalReturn >= 0 ? Color.profitGreen : Color.lossRed,
                    icon: "percent"
                )
            }

            // Recommendations
            if let recommendations = metrics.recommendations, !recommendations.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Recommendations")
                        .font(.headline)
                        .foregroundStyle(.white)
                    ForEach(recommendations, id: \.self) { rec in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "lightbulb.fill")
                                .foregroundStyle(Color.statusWarning)
                                .font(.caption)
                            Text(rec)
                                .font(.subheadline)
                                .foregroundStyle(Color.textSecondary)
                        }
                    }
                }
                .padding()
                .cardStyle()
            }

            // Live eligibility
            if let eligible = metrics.eligibleForLive {
                HStack {
                    Image(systemName: eligible ? "checkmark.seal.fill" : "xmark.seal.fill")
                        .foregroundStyle(eligible ? Color.profitGreen : Color.statusDanger)
                    Text(eligible ? "Eligible for live trading" : "Not yet eligible for live trading")
                        .font(.subheadline)
                        .foregroundStyle(.white)
                    if let remaining = metrics.tradesRemaining, remaining > 0 {
                        Text("(\(remaining) trades remaining)")
                            .font(.caption)
                            .foregroundStyle(Color.textMuted)
                    }
                }
                .padding()
                .cardStyle()
            }
        }
    }
}
