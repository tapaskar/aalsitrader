import SwiftUI

struct FilterBarView: View {
    @Binding var selected: String
    let options: [(id: String, label: String)]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(options, id: \.id) { option in
                    Button {
                        HapticService.selection()
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selected = option.id
                        }
                    } label: {
                        Text(option.label)
                            .font(.caption.bold())
                            .foregroundStyle(selected == option.id ? .white : Color.textSecondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                selected == option.id
                                    ? AnyShapeStyle(Color.accentCyan.opacity(0.3))
                                    : AnyShapeStyle(Color.cardBackground)
                            )
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().stroke(
                                    selected == option.id ? Color.accentCyan : Color.appBorder.opacity(0.3),
                                    lineWidth: 1
                                )
                            )
                    }
                }
            }
            .padding(.horizontal)
        }
    }
}
