import SwiftUI

struct TrialBannerView: View {
    @State private var dismissed = false
    private var user: User? { AuthViewModel.shared.user }

    var body: some View {
        if !dismissed, let user, let planStatus = user.planStatus {
            switch planStatus {
            case .trial:
                bannerView(
                    icon: "clock.badge.exclamationmark",
                    message: trialMessage(user: user),
                    backgroundColor: Color.statusWarning.opacity(0.12),
                    borderColor: Color.statusWarning.opacity(0.3),
                    textColor: Color.statusWarning,
                    showDismiss: true
                )

            case .expired:
                bannerView(
                    icon: "exclamationmark.triangle.fill",
                    message: "Your trial has expired. Subscribe to continue.",
                    backgroundColor: Color.statusDanger.opacity(0.12),
                    borderColor: Color.statusDanger.opacity(0.3),
                    textColor: Color.statusDanger,
                    showDismiss: true
                )

            case .active, .cancelled:
                EmptyView()
            }
        }
    }

    private func trialMessage(user: User) -> String {
        guard let trialEndsAt = user.trialEndsAt,
              let endDate = Date.fromISO(trialEndsAt) else {
            return "You are on a trial plan."
        }

        let daysRemaining = Calendar.current.dateComponents([.day], from: Date(), to: endDate).day ?? 0

        if daysRemaining <= 0 {
            return "Your trial expires today."
        } else if daysRemaining == 1 {
            return "Trial ends in 1 day."
        } else {
            return "Trial ends in \(daysRemaining) days."
        }
    }

    private func bannerView(
        icon: String,
        message: String,
        backgroundColor: Color,
        borderColor: Color,
        textColor: Color,
        showDismiss: Bool
    ) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.subheadline)
                .foregroundStyle(textColor)

            Text(message)
                .font(.caption)
                .foregroundStyle(textColor)

            Spacer()

            if showDismiss {
                Button {
                    withAnimation(.easeOut(duration: 0.2)) {
                        dismissed = true
                    }
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption2)
                        .foregroundStyle(textColor.opacity(0.7))
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(borderColor, lineWidth: 1)
        )
        .padding(.horizontal)
    }
}
