import SwiftUI

struct AdminOverviewView: View {
    let stats: AdminService.SystemStats

    var body: some View {
        VStack(spacing: 16) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                StatCardView(
                    title: "Total Users",
                    value: "\(stats.totalUsers)",
                    color: Color.accentCyan,
                    icon: "person.3"
                )
                StatCardView(
                    title: "Active (24h)",
                    value: "\(stats.activeLastDay)",
                    color: Color.statusActive,
                    icon: "clock"
                )
                StatCardView(
                    title: "Live Traders",
                    value: "\(stats.liveTraders)",
                    color: Color.profitGreen,
                    icon: "bolt.fill"
                )
                StatCardView(
                    title: "Trial Users",
                    value: "\(stats.trialUsers)",
                    color: Color.statusWarning,
                    icon: "hourglass"
                )
            }

            // Plan breakdown
            if let breakdown = stats.planBreakdown, !breakdown.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Plan Breakdown")
                        .font(.headline)
                        .foregroundStyle(.white)

                    ForEach(breakdown.sorted(by: { $0.key < $1.key }), id: \.key) { plan, count in
                        HStack {
                            Text(plan.capitalized)
                                .font(.subheadline)
                                .foregroundStyle(.white)
                            Spacer()
                            Text("\(count)")
                                .font(.subheadline.bold())
                                .foregroundStyle(Color.accentCyan)

                            // Progress bar
                            GeometryReader { geo in
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(Color.appBorder.opacity(0.3))
                                    .overlay(alignment: .leading) {
                                        RoundedRectangle(cornerRadius: 3)
                                            .fill(Color.accentCyan)
                                            .frame(width: geo.size.width * Double(count) / max(Double(stats.totalUsers), 1))
                                    }
                            }
                            .frame(width: 80, height: 6)
                        }
                    }
                }
                .padding()
                .cardStyle()
            }
        }
    }
}
