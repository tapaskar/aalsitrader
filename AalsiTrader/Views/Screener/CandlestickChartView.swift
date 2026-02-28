import SwiftUI
import Charts

struct CandlestickChartView: View {
    let candles: [CandleData]
    var support: Double?
    var resistance: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Price Chart")
                .sectionHeader()

            if candles.isEmpty {
                EmptyStateView(icon: "chart.bar", title: "Loading chart...")
                    .frame(height: 250)
            } else {
                Chart {
                    ForEach(candles) { candle in
                        // Wick (high-low line)
                        RectangleMark(
                            x: .value("Date", candle.date),
                            yStart: .value("Low", candle.low),
                            yEnd: .value("High", candle.high),
                            width: 1
                        )
                        .foregroundStyle(candle.close >= candle.open ? Color.profitGreen : Color.lossRed)

                        // Body (open-close)
                        RectangleMark(
                            x: .value("Date", candle.date),
                            yStart: .value("Open", candle.open),
                            yEnd: .value("Close", candle.close),
                            width: 4
                        )
                        .foregroundStyle(candle.close >= candle.open ? Color.profitGreen : Color.lossRed)
                    }

                    // Support line
                    if let support {
                        RuleMark(y: .value("Support", support))
                            .foregroundStyle(Color.profitGreen.opacity(0.5))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 3]))
                            .annotation(position: .leading) {
                                Text("S")
                                    .font(.caption2)
                                    .foregroundStyle(Color.profitGreen)
                            }
                    }

                    // Resistance line
                    if let resistance {
                        RuleMark(y: .value("Resistance", resistance))
                            .foregroundStyle(Color.lossRed.opacity(0.5))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 3]))
                            .annotation(position: .leading) {
                                Text("R")
                                    .font(.caption2)
                                    .foregroundStyle(Color.lossRed)
                            }
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 5)) { _ in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                            .foregroundStyle(Color.appBorder.opacity(0.3))
                        AxisValueLabel()
                            .foregroundStyle(Color.textMuted)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .trailing, values: .automatic(desiredCount: 5)) { _ in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                            .foregroundStyle(Color.appBorder.opacity(0.3))
                        AxisValueLabel()
                            .foregroundStyle(Color.textMuted)
                    }
                }
                .frame(height: 250)
                .padding()
                .cardStyle()
            }
        }
    }
}
