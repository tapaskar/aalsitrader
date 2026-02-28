import SwiftUI

struct PositionCardView: View {
    let position: StraddlePosition

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Current Position")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                PillBadgeView(text: position.mode.rawValue.uppercased(), color: position.mode == .live ? Color.statusWarning : Color.accentCyan)
            }

            // Strategy info
            if let label = position.strategyLabel ?? position.strategyType?.displayName {
                Text(label)
                    .font(.subheadline)
                    .foregroundStyle(Color.textSecondary)
            }

            // Legs
            if let legs = position.legs, !legs.isEmpty {
                ForEach(legs) { leg in
                    HStack {
                        PillBadgeView(text: leg.side, color: leg.side == "CE" ? Color.profitGreen : Color.lossRed)
                        Text("\(leg.strikePrice, specifier: "%.0f")")
                            .font(.subheadline).foregroundStyle(.white)
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("Entry: \(leg.entryPremium, specifier: "%.2f")")
                                .font(.caption).foregroundStyle(Color.textSecondary)
                            Text("Current: \(leg.curPremium, specifier: "%.2f")")
                                .font(.caption).foregroundStyle(.white)
                        }
                    }
                }
            } else {
                // Fallback to CE/PE display
                HStack {
                    legColumn("CE", strike: position.ceStrike, entry: position.ceEntryPremium, current: position.ceCurPremium)
                    Divider().overlay(Color.appBorder)
                    legColumn("PE", strike: position.peStrike, entry: position.peEntryPremium, current: position.peCurPremium)
                }
            }

            Divider().overlay(Color.appBorder)

            // P&L
            HStack {
                VStack(alignment: .leading) {
                    Text("Collected")
                        .font(.caption).foregroundStyle(Color.textSecondary)
                    Text(position.totalCollected.inrFormatted)
                        .font(.subheadline).foregroundStyle(.white)
                }
                Spacer()
                VStack(alignment: .center) {
                    Text("Current")
                        .font(.caption).foregroundStyle(Color.textSecondary)
                    Text(position.totalCurrent.inrFormatted)
                        .font(.subheadline).foregroundStyle(.white)
                }
                Spacer()
                VStack(alignment: .trailing) {
                    Text("Unrealized P&L")
                        .font(.caption).foregroundStyle(Color.textSecondary)
                    PnLTextView(value: position.unrealizedPnl, font: .subheadline.bold())
                }
            }

            // Nifty spot
            HStack {
                Text("Nifty Entry: \(position.niftyEntry, specifier: "%.1f")")
                    .font(.caption).foregroundStyle(Color.textSecondary)
                Spacer()
                Text("Since \(position.entryTime)")
                    .font(.caption).foregroundStyle(Color.textMuted)
            }
        }
        .padding()
        .cardStyle()
    }

    private func legColumn(_ side: String, strike: Double, entry: Double, current: Double) -> some View {
        VStack(spacing: 4) {
            Text(side)
                .font(.caption.bold())
                .foregroundStyle(side == "CE" ? Color.profitGreen : Color.lossRed)
            Text("\(strike, specifier: "%.0f")")
                .font(.headline).foregroundStyle(.white)
            Text("E: \(entry, specifier: "%.2f")")
                .font(.caption).foregroundStyle(Color.textSecondary)
            Text("C: \(current, specifier: "%.2f")")
                .font(.caption.bold()).foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity)
    }
}
