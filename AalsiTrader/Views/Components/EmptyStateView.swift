import SwiftUI

struct EmptyStateView: View {
    let icon: String
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundStyle(Color.textMuted)
            Text(title)
                .font(.headline)
                .foregroundStyle(Color.textSecondary)
            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(Color.textMuted)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}
