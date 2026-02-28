import SwiftUI

struct TradeDetailSheet: View {
    let trade: PaperTrade
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        // Header
                        HStack {
                            VStack(alignment: .leading) {
                                Text(trade.symbol)
                                    .font(.title2.bold())
                                    .foregroundStyle(.white)
                                HStack {
                                    PillBadgeView(text: trade.signal.rawValue, color: trade.signal == .BUY ? Color.profitGreen : Color.lossRed)
                                    PillBadgeView(text: trade.status.rawValue.uppercased(), color: trade.status == .open ? Color.accentCyan : Color.textMuted)
                                }
                            }
                            Spacer()
                            if let pnl = trade.netPnL {
                                PnLTextView(value: pnl, font: .title3.bold())
                            }
                        }
                        .padding()
                        .cardStyle()

                        // Price details
                        detailSection("Price Details") {
                            detailRow("Entry Price", String(format: "%.2f", trade.entryPrice))
                            if let exit = trade.exitPrice {
                                detailRow("Exit Price", String(format: "%.2f", exit))
                            }
                            if let optEntry = trade.optionEntryPrice {
                                detailRow("Option Entry", String(format: "%.2f", optEntry))
                            }
                            if let optExit = trade.optionExitPrice {
                                detailRow("Option Exit", String(format: "%.2f", optExit))
                            }
                            if let strike = trade.atmStrike {
                                detailRow("ATM Strike", String(format: "%.0f", strike))
                            }
                            if let optType = trade.optionType {
                                detailRow("Option Type", optType.rawValue)
                            }
                        }

                        // Lots & Margin
                        detailSection("Position Details") {
                            if let lots = trade.futuresLots { detailRow("Futures Lots", "\(lots)") }
                            if let lots = trade.optionLots { detailRow("Option Lots", "\(lots)") }
                            if let lotSize = trade.lotSize { detailRow("Lot Size", "\(lotSize)") }
                            if let margin = trade.marginUsed { detailRow("Margin Used", margin.inrFormatted) }
                            if let hedge = trade.hedgeCost { detailRow("Hedge Cost", hedge.inrFormatted) }
                            if let risk = trade.initialRisk { detailRow("Initial Risk", risk.inrFormatted) }
                        }

                        // P&L Breakdown
                        detailSection("P&L Breakdown") {
                            if let gross = trade.grossPnL { detailRow("Gross P&L", gross.inrFormatted) }
                            if let hedge = trade.hedgePnL { detailRow("Hedge P&L", hedge.inrFormatted) }
                            if let net = trade.netPnL { detailRow("Net P&L", net.inrFormatted) }
                            if let brok = trade.brokerage { detailRow("Brokerage", brok.inrFormatted) }
                            if let stt = trade.stt { detailRow("STT", stt.inrFormatted) }
                            if let charges = trade.totalCharges { detailRow("Total Charges", charges.inrFormatted) }
                        }

                        // Timing
                        detailSection("Timing") {
                            detailRow("Entry", trade.entryTime.asDate.istDateTime)
                            if let exit = trade.exitTime {
                                detailRow("Exit", exit.asDate.istDateTime)
                            }
                            if let reason = trade.exitReason {
                                detailRow("Exit Reason", reason.rawValue)
                            }
                            if let duration = trade.duration {
                                detailRow("Duration", duration)
                            }
                        }

                        // Indicators
                        if let indicators = trade.indicators {
                            detailSection("Indicators") {
                                if let rsi = indicators.rsi { detailRow("RSI", String(format: "%.1f", rsi)) }
                                if let macd = indicators.macd { detailRow("MACD", String(format: "%.2f", macd)) }
                                if let trend = indicators.trend { detailRow("Trend", trend) }
                                if let conf = indicators.confidence { detailRow("Confidence", String(format: "%.0f%%", conf)) }
                            }
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Trade Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.accentCyan)
                }
            }
        }
    }

    private func detailSection(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundStyle(.white)
            VStack(spacing: 6) {
                content()
            }
            .padding()
            .cardStyle()
        }
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Color.textSecondary)
            Spacer()
            Text(value)
                .font(.subheadline)
                .foregroundStyle(.white)
        }
    }
}
