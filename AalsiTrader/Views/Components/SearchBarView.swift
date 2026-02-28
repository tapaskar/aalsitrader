import SwiftUI

struct SearchBarView: View {
    @Binding var text: String
    var placeholder: String = "Search..."

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.textMuted)
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .autocapitalization(.none)
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.textMuted)
                }
            }
        }
        .padding(10)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.appBorder.opacity(0.3)))
    }
}
