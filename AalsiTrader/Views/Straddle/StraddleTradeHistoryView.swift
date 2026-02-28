import SwiftUI

struct StraddleTradeHistoryView: View {
    let trades: [StraddleTrade]
    @Binding var dateFrom: Date
    @Binding var dateTo: Date
    let onDateChange: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Trade History")
                .sectionHeader()

            // Date filters
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("From").font(.caption2).foregroundStyle(Color.textMuted)
                    DatePicker("", selection: $dateFrom, displayedComponents: .date)
                        .labelsHidden()
                        .tint(Color.accentCyan)
                        .onChange(of: dateFrom) { _, _ in onDateChange() }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("To").font(.caption2).foregroundStyle(Color.textMuted)
                    DatePicker("", selection: $dateTo, displayedComponents: .date)
                        .labelsHidden()
                        .tint(Color.accentCyan)
                        .onChange(of: dateTo) { _, _ in onDateChange() }
                }
            }

            if trades.isEmpty {
                EmptyStateView(
                    icon: "clock.arrow.circlepath",
                    title: "No trades in this period"
                )
            } else {
                LazyVStack(spacing: 8) {
                    ForEach(trades) { trade in
                        straddleTradeRow(trade)
                    }
                }
            }
        }
    }

    private func straddleTradeRow(_ trade: StraddleTrade) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(trade.tradeDate)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                if let index = trade.indexName {
                    PillBadgeView(text: index.rawValue, color: Color.accentCyan)
                }
                PillBadgeView(text: trade.mode.rawValue.uppercased(), color: trade.mode == .live ? Color.statusWarning : Color.textMuted)
                Spacer()
                PnLTextView(value: trade.netPnl, font: .subheadline.bold())
            }

            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("CE: \(trade.ceEntryPremium, specifier: "%.2f") → \(trade.ceExitPremium, specifier: "%.2f")")
                        .font(.caption).foregroundStyle(Color.textSecondary)
                    Text("PE: \(trade.peEntryPremium, specifier: "%.2f") → \(trade.peExitPremium, specifier: "%.2f")")
                        .font(.caption).foregroundStyle(Color.textSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Exit: \(trade.exitReason)")
                        .font(.caption).foregroundStyle(Color.textMuted)
                    Text(trade.strategyType)
                        .font(.caption2).foregroundStyle(Color.textMuted)
                }
            }
        }
        .padding(12)
        .cardStyle()
    }
}
