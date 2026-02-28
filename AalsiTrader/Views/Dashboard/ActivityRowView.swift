import SwiftUI

struct ActivityRowView: View {
    let activity: Activity

    private var agentColor: Color {
        AgentDefinitions.color(for: activity.agentId)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            // Agent avatar indicator
            ZStack(alignment: .bottomTrailing) {
                AgentAvatarView(agentId: activity.agentId, size: 28)
                Circle()
                    .fill(typeColor)
                    .frame(width: 8, height: 8)
                    .overlay(Circle().stroke(Color.appBackground, lineWidth: 1.5))
                    .offset(x: 2, y: 2)
            }
            .frame(width: 30)

            VStack(alignment: .leading, spacing: 4) {
                Text(activity.content)
                    .font(.subheadline)
                    .foregroundStyle(.white)
                    .lineLimit(3)

                HStack(spacing: 6) {
                    Text(activity.agentName)
                        .font(.caption2)
                        .foregroundStyle(agentColor)

                    TimeAgoText(date: activity.date, font: .caption2)

                    if let tags = activity.tags {
                        ForEach(tags.prefix(2), id: \.self) { tag in
                            PillBadgeView(text: tag, color: Color.textMuted)
                        }
                    }
                }
            }

            Spacer()
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    private var typeColor: Color {
        switch activity.type {
        case .info: return .accentCyan
        case .alert: return .statusWarning
        case .success: return .statusActive
        case .warning: return .statusWarning
        case .error: return .statusDanger
        }
    }
}
