import SwiftUI

struct StockRowView: View {
    let stock: SmartMoneyStock

    var body: some View {
        HStack(spacing: 12) {
            // Symbol & signal
            VStack(alignment: .leading, spacing: 4) {
                Text(stock.symbol)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                PillBadgeView(
                    text: stock.signal.rawValue,
                    color: stock.signal == .BUY ? Color.profitGreen : stock.signal == .SELL ? Color.lossRed : Color.textMuted
                )
            }
            .frame(width: 80, alignment: .leading)

            // Price
            Text("₹\(stock.price, specifier: "%.1f")")
                .font(.subheadline)
                .foregroundStyle(.white)
                .frame(width: 70, alignment: .trailing)

            // Trend strength bar
            VStack(spacing: 2) {
                GeometryReader { geo in
                    ZStack(alignment: stock.trendStrength >= 0 ? .leading : .trailing) {
                        Rectangle()
                            .fill(Color.appBorder.opacity(0.3))
                            .frame(height: 6)
                        Rectangle()
                            .fill(stock.trendStrength >= 0 ? Color.profitGreen : Color.lossRed)
                            .frame(width: geo.size.width * abs(stock.trendStrength) / 100, height: 6)
                    }
                    .clipShape(Capsule())
                }
                .frame(height: 6)
                Text("\(Int(stock.trendStrength))")
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)
            }
            .frame(width: 50)

            // RSI
            VStack(spacing: 0) {
                Text("\(stock.rsi, specifier: "%.0f")")
                    .font(.caption.bold())
                    .foregroundStyle(
                        stock.rsi > 70 ? Color.lossRed :
                        stock.rsi < 30 ? Color.profitGreen : .white
                    )
                Text("RSI")
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)
            }
            .frame(width: 36)

            // Structure
            Text(stock.structure.displayName)
                .font(.caption2)
                .foregroundStyle(stock.structure.isBullish ? Color.profitGreen : Color.lossRed)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .trailing)

            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(Color.textMuted)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .cardStyle()
    }
}
