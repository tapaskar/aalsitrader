import SwiftUI

struct AgentCardView: View {
    let agent: Agent

    var body: some View {
        VStack(spacing: 8) {
            ZStack(alignment: .topTrailing) {
                AgentAvatarView(agentId: agent.id, size: 44)

                Circle()
                    .fill(statusColor)
                    .frame(width: 10, height: 10)
                    .overlay(
                        Circle().stroke(Color.cardBackground, lineWidth: 2)
                    )
                    .offset(x: 4, y: -4)
            }

            Text(agent.name)
                .font(.caption.bold())
                .foregroundStyle(.white)
                .lineLimit(1)

            Text(agent.role)
                .font(.caption2)
                .foregroundStyle(Color.textSecondary)
                .lineLimit(1)

            if let task = agent.currentTask {
                Text(task)
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)
                    .lineLimit(1)
            }
        }
        .frame(width: 100)
        .padding(.vertical, 12)
        .padding(.horizontal, 8)
        .cardStyle()
    }

    private var statusColor: Color {
        switch agent.status {
        case .active: return .statusActive
        case .sleeping: return .statusSleeping
        case .error: return .statusDanger
        }
    }
}
