import SwiftUI

struct TradeRowView: View {
    let trade: PaperTrade

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(trade.symbol)
                        .font(.subheadline.bold())
                        .foregroundStyle(.white)
                    PillBadgeView(
                        text: trade.signal.rawValue,
                        color: trade.signal == .BUY ? Color.profitGreen : Color.lossRed
                    )
                }

                HStack(spacing: 8) {
                    Text("Entry: \(trade.entryPrice, specifier: "%.2f")")
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary)
                    if let exit = trade.exitPrice {
                        Text("Exit: \(exit, specifier: "%.2f")")
                            .font(.caption)
                            .foregroundStyle(Color.textSecondary)
                    }
                }

                if let duration = trade.duration {
                    Text(duration)
                        .font(.caption2)
                        .foregroundStyle(Color.textMuted)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                if let pnl = trade.netPnL {
                    PnLTextView(value: pnl, font: .subheadline.bold())
                }
                if let pct = trade.pnlPercent {
                    Text("\(pct >= 0 ? "+" : "")\(pct, specifier: "%.2f")%")
                        .font(.caption)
                        .foregroundStyle(pct >= 0 ? Color.profitGreen : Color.lossRed)
                }
                if let reason = trade.exitReason {
                    PillBadgeView(text: reason.rawValue, color: Color.textMuted)
                }
            }
        }
        .padding(12)
        .cardStyle()
    }
}
