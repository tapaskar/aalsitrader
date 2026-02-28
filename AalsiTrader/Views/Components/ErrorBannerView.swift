import SwiftUI

struct ErrorBannerView: View {
    let message: String
    var onRetry: (() -> Void)?

    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.statusDanger)
            Text(message)
                .font(.caption)
                .foregroundStyle(.white)
                .lineLimit(2)
            Spacer()
            if let onRetry {
                Button("Retry", action: onRetry)
                    .font(.caption.bold())
                    .foregroundStyle(Color.accentCyan)
            }
        }
        .padding(10)
        .background(Color.statusDanger.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.statusDanger.opacity(0.3)))
    }
}
