import SwiftUI

struct ActivityFeedView: View {
    let activities: [Activity]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Activity Feed")
                    .sectionHeader()
                Text("\(activities.count)")
                    .font(.caption)
                    .foregroundStyle(Color.textMuted)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.cardBackground)
                    .clipShape(Capsule())
            }
            .padding(.horizontal)

            if activities.isEmpty {
                EmptyStateView(
                    icon: "antenna.radiowaves.left.and.right",
                    title: "No activity yet",
                    subtitle: "Agent activities will appear here"
                )
            } else {
                LazyVStack(spacing: 4) {
                    ForEach(activities.prefix(50)) { activity in
                        ActivityRowView(activity: activity)
                    }
                }
            }
        }
    }
}
