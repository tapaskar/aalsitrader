import SwiftUI

struct StockDetailSheet: View {
    let stock: SmartMoneyStock
    @Bindable var vm: ScreenerViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        // Header
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(stock.symbol)
                                    .font(.title2.bold())
                                    .foregroundStyle(.white)
                                Text("₹\(stock.price, specifier: "%.2f")")
                                    .font(.title3)
                                    .foregroundStyle(.white)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                PillBadgeView(
                                    text: stock.signal.rawValue,
                                    color: stock.signal == .BUY ? Color.profitGreen : stock.signal == .SELL ? Color.lossRed : Color.textMuted
                                )
                                PillBadgeView(text: stock.structure.displayName, color: stock.structure.isBullish ? Color.profitGreen : Color.lossRed)
                            }
                        }
                        .padding()
                        .cardStyle()

                        // Candlestick chart
                        CandlestickChartView(candles: vm.chartData, support: stock.support, resistance: stock.resistance)

                        // Stats grid
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                            StatCardView(title: "Trend Strength", value: "\(Int(stock.trendStrength))", color: stock.trendStrength >= 0 ? Color.profitGreen : Color.lossRed)
                            StatCardView(title: "Confidence", value: "\(Int(stock.confidence))%", color: stock.confidence >= 70 ? Color.profitGreen : Color.statusWarning)
                            StatCardView(title: "RSI", value: String(format: "%.1f", stock.rsi), color: stock.rsi > 70 ? Color.lossRed : stock.rsi < 30 ? Color.profitGreen : Color.accentCyan)
                            StatCardView(title: "5D Momentum", value: String(format: "%.1f%%", stock.momentum5d ?? 0), color: (stock.momentum5d ?? 0) >= 0 ? Color.profitGreen : Color.lossRed)
                        }

                        // Support/Resistance
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Key Levels")
                                .font(.headline).foregroundStyle(.white)
                            HStack {
                                if let support = stock.support {
                                    StatCardView(title: "Support", value: "₹" + String(format: "%.1f", support), color: Color.profitGreen, icon: "arrow.down.to.line")
                                }
                                if let resistance = stock.resistance {
                                    StatCardView(title: "Resistance", value: "₹" + String(format: "%.1f", resistance), color: Color.lossRed, icon: "arrow.up.to.line")
                                }
                            }
                            HStack {
                                if let sma20 = stock.sma20 {
                                    StatCardView(title: "SMA 20", value: "₹" + String(format: "%.1f", sma20), color: Color.betaTeal)
                                }
                                if let sma50 = stock.sma50 {
                                    StatCardView(title: "SMA 50", value: "₹" + String(format: "%.1f", sma50), color: Color.thetaOrange)
                                }
                            }
                        }

                        if stock.volumeSurge == true {
                            HStack {
                                Image(systemName: "speaker.wave.3.fill")
                                    .foregroundStyle(Color.statusWarning)
                                Text("Volume Surge Detected")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(Color.statusWarning)
                            }
                            .padding()
                            .frame(maxWidth: .infinity)
                            .cardStyle()
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle(stock.symbol)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.accentCyan)
                }
            }
            .task {
                await vm.loadChart(symbol: stock.symbol)
            }
        }
    }
}
