import SwiftUI

struct StatCardView: View {
    let title: String
    let value: String
    var subtitle: String?
    var color: Color = .accentCyan
    var icon: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                if let icon {
                    Image(systemName: icon)
                        .font(.caption2)
                        .foregroundStyle(color)
                }
                Text(title)
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary)
            }

            Text(value)
                .font(.title3.bold())
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            if let subtitle {
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .cardStyle()
    }
}
