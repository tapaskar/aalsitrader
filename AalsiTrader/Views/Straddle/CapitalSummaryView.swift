import SwiftUI

struct CapitalSummaryView: View {
    let capital: StraddleCapital

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Capital")
                .sectionHeader()

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                StatCardView(
                    title: "Current Capital",
                    value: capital.currentCapital.inrShort,
                    color: Color.accentCyan,
                    icon: "banknote"
                )
                StatCardView(
                    title: "Total P&L",
                    value: capital.totalPnl.inrShort,
                    color: capital.totalPnl >= 0 ? Color.profitGreen : Color.lossRed,
                    icon: "indianrupeesign"
                )
                StatCardView(
                    title: "Win Rate",
                    value: capital.winRate.pctFormatted,
                    color: capital.winRate >= 50 ? Color.profitGreen : Color.lossRed,
                    icon: "target"
                )
                StatCardView(
                    title: "Max Drawdown",
                    value: capital.maxDrawdownPct.pctFormatted,
                    color: Color.statusDanger,
                    icon: "arrow.down.right"
                )
            }
        }
    }
}
