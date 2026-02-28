import SwiftUI

struct ChatBubbleView: View {
    let message: ChatMessage

    private var isUser: Bool {
        message.role == .user
    }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if isUser {
                Spacer(minLength: 60)
            }

            if !isUser {
                // Prime avatar
                AgentAvatarView(agentId: "sigma", size: 32)
            }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                // Message bubble
                Text(message.content)
                    .font(.subheadline)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        isUser
                            ? Color.accentCyan.opacity(0.25)
                            : Color.cardBackground
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(
                                isUser
                                    ? Color.accentCyan.opacity(0.4)
                                    : Color.appBorder.opacity(0.3),
                                lineWidth: 1
                            )
                    )

                // Intent badge (Prime messages only)
                if !isUser, let intent = message.intent, !intent.isEmpty {
                    PillBadgeView(text: intent, color: Color.sigmaGreen)
                }

                // Timestamp
                Text(message.date.istTime)
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)
            }

            if !isUser {
                Spacer(minLength: 60)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 2)
    }
}
