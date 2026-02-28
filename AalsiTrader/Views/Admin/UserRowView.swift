import SwiftUI

struct UserRowView: View {
    let user: User

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            Circle()
                .fill(user.isAdmin ? Color.statusWarning.opacity(0.2) : Color.accentCyan.opacity(0.2))
                .frame(width: 36, height: 36)
                .overlay(
                    Text(String(user.username.prefix(1)).uppercased())
                        .font(.subheadline.bold())
                        .foregroundStyle(user.isAdmin ? Color.statusWarning : Color.accentCyan)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(user.username)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                Text(user.email)
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(1)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                HStack(spacing: 4) {
                    if let plan = user.plan {
                        PillBadgeView(text: plan.rawValue.uppercased(), color: planColor(plan))
                    }
                    if user.isAdmin {
                        PillBadgeView(text: "ADMIN", color: Color.statusWarning)
                    }
                }

                if let lastActive = user.lastActive {
                    TimeAgoText(date: Date.fromEpoch(lastActive), font: .caption2)
                }
            }

            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(Color.textMuted)
        }
        .padding(12)
        .cardStyle()
    }

    private func planColor(_ plan: PlanType) -> Color {
        switch plan {
        case .starter: return .textSecondary
        case .pro: return .accentCyan
        case .premium: return .statusWarning
        }
    }
}
