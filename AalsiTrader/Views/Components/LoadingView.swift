import SwiftUI

struct LoadingView: View {
    var label: String = "Loading..."

    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(Color.accentCyan)
                .scaleEffect(1.2)
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
