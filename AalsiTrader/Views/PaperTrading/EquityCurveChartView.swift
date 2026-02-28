import SwiftUI
import Charts

struct EquityCurveChartView: View {
    let points: [EquityPoint]

    private var minCapital: Double {
        (points.map(\.capital).min() ?? 0) * 0.99
    }

    private var maxCapital: Double {
        (points.map(\.capital).max() ?? 100) * 1.01
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Equity Curve")
                .sectionHeader()

            if points.isEmpty {
                EmptyStateView(icon: "chart.xyaxis.line", title: "No equity data")
                    .frame(height: 200)
            } else {
                Chart {
                    ForEach(points) { point in
                        AreaMark(
                            x: .value("Time", point.date),
                            yStart: .value("Min", minCapital),
                            yEnd: .value("Capital", point.capital)
                        )
                        .foregroundStyle(
                            LinearGradient(
                                colors: [Color.accentCyan.opacity(0.3), Color.accentCyan.opacity(0.05)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )

                        LineMark(
                            x: .value("Time", point.date),
                            y: .value("Capital", point.capital)
                        )
                        .foregroundStyle(Color.accentCyan)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                    }
                }
                .chartYScale(domain: minCapital...maxCapital)
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 5)) { _ in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                            .foregroundStyle(Color.appBorder.opacity(0.3))
                        AxisValueLabel()
                            .foregroundStyle(Color.textMuted)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                            .foregroundStyle(Color.appBorder.opacity(0.3))
                        AxisValueLabel {
                            if let v = value.as(Double.self) {
                                Text(v.inrShort)
                                    .font(.caption2)
                                    .foregroundStyle(Color.textMuted)
                            }
                        }
                    }
                }
                .frame(height: 200)
                .padding()
                .cardStyle()
            }
        }
    }
}
