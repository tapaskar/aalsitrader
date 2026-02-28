import SwiftUI

struct RecentTradesSection: View {
    let trades: [PaperTrade]
    @State private var selectedTrade: PaperTrade?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Section header
            HStack {
                Text("Open Trades")
                    .sectionHeader()

                Text("\(trades.count)")
                    .font(.caption2.bold())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(Color.accentCyan.opacity(0.25))
                    .clipShape(Capsule())

                Spacer()
            }
            .padding(.horizontal)

            // Trade rows (up to 5)
            VStack(spacing: 6) {
                ForEach(trades.prefix(5)) { trade in
                    compactTradeRow(trade)
                        .onTapGesture {
                            HapticService.selection()
                            selectedTrade = trade
                        }
                }
            }
            .padding(.horizontal)
        }
        .sheet(item: $selectedTrade) { trade in
            TradeDetailSheet(trade: trade)
        }
    }

    private func compactTradeRow(_ trade: PaperTrade) -> some View {
        HStack(spacing: 10) {
            // Symbol
            VStack(alignment: .leading, spacing: 2) {
                Text(trade.symbol)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    PillBadgeView(
                        text: trade.signal.rawValue,
                        color: trade.signal == .BUY ? Color.profitGreen : Color.lossRed
                    )

                    Text(String(format: "%.2f", trade.entryPrice))
                        .font(.caption2)
                        .foregroundStyle(Color.textSecondary)
                }
            }

            Spacer()

            // P&L
            if let pnl = trade.netPnL {
                VStack(alignment: .trailing, spacing: 2) {
                    PnLTextView(value: pnl, font: .subheadline.bold())

                    if let pct = trade.pnlPercent {
                        Text("\(pct >= 0 ? "+" : "")\(String(format: "%.2f", pct))%")
                            .font(.caption2)
                            .foregroundStyle(pct >= 0 ? Color.profitGreen : Color.lossRed)
                    }
                }
            }

            // Chevron
            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(Color.textMuted)
        }
        .padding(10)
        .cardStyle()
    }
}
