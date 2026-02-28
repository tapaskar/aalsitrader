import SwiftUI

struct CommBubbleView: View {
    let comm: CommMessage

    private var fromColor: Color {
        AgentDefinitions.color(for: comm.from.lowercased())
    }

    private var toColor: Color {
        AgentDefinitions.color(for: comm.to.lowercased())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                AgentAvatarView(agentId: comm.from.lowercased(), size: 22)
                Text(comm.from)
                    .font(.caption)
                    .foregroundStyle(fromColor)
                Image(systemName: "arrow.right")
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)
                AgentAvatarView(agentId: comm.to.lowercased(), size: 22)
                Text(comm.to)
                    .font(.caption)
                    .foregroundStyle(toColor)
                Spacer()
                TimeAgoText(date: comm.date, font: .caption2)
            }

            Text(comm.content)
                .font(.subheadline)
                .foregroundStyle(.white)
        }
        .padding(10)
        .cardStyle()
    }
}
