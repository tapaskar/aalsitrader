import SwiftUI

struct ScreenerSummaryCards: View {
    let bullish: Int
    let bearish: Int
    let strong: Int
    let total: Int
    var onFilterBullish: () -> Void
    var onFilterBearish: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Button(action: onFilterBullish) {
                StatCardView(
                    title: "Bullish",
                    value: "\(bullish)",
                    subtitle: "signals",
                    color: Color.profitGreen,
                    icon: "arrow.up.right"
                )
            }
            .buttonStyle(.plain)

            Button(action: onFilterBearish) {
                StatCardView(
                    title: "Bearish",
                    value: "\(bearish)",
                    subtitle: "signals",
                    color: Color.lossRed,
                    icon: "arrow.down.right"
                )
            }
            .buttonStyle(.plain)

            StatCardView(
                title: "Strong",
                value: "\(strong)",
                subtitle: "of \(total)",
                color: Color.accentCyan,
                icon: "bolt.fill"
            )
        }
    }
}
