import SwiftUI

extension View {
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }

    func cardStyle() -> some View {
        self
            .background(Color.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.appBorder.opacity(0.3), lineWidth: 1)
            )
    }

    func sectionHeader() -> some View {
        self
            .font(.headline)
            .foregroundStyle(.white)
    }
}
