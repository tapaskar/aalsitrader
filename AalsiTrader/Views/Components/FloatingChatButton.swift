import SwiftUI

struct FloatingChatButton: View {
    @State private var showChat = false
    @State private var isPressed = false

    var body: some View {
        Button {
            HapticService.impact(.medium)
            showChat = true
        } label: {
            ZStack {
                // Outer glow
                Circle()
                    .fill(Color.accentCyan.opacity(0.15))
                    .frame(width: 64, height: 64)

                // Main circle
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.accentCyan,
                                Color.accentCyan.opacity(0.8)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 52, height: 52)
                    .shadow(color: Color.accentCyan.opacity(0.4), radius: 8, x: 0, y: 4)

                // Prime agent icon
                Image(systemName: "scope")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
            }
            .scaleEffect(isPressed ? 0.9 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isPressed)
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
        .sheet(isPresented: $showChat) {
            PrimeChatView()
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Color.appBackground)
        }
    }
}
