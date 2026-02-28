import SwiftUI

struct AuthContainerView: View {
    @State private var showRegister = false
    @State private var showForgotPassword = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                VStack(spacing: 24) {
                    // Logo
                    VStack(spacing: 12) {
                        // Agent squad avatars in a row
                        HStack(spacing: -8) {
                            AgentAvatarView(agentId: "alpha", size: 36)
                            AgentAvatarView(agentId: "beta", size: 36)
                            AgentAvatarView(agentId: "sigma", size: 48)
                            AgentAvatarView(agentId: "gamma", size: 36)
                            AgentAvatarView(agentId: "theta", size: 36)
                        }
                        Text("AalsiTrader")
                            .font(.title.bold())
                            .foregroundStyle(.white)
                        Text("AI-Powered Trading Squad")
                            .font(.subheadline)
                            .foregroundStyle(Color.textSecondary)
                    }
                    .padding(.top, 40)

                    if showRegister {
                        RegisterView(showRegister: $showRegister)
                    } else {
                        LoginView(
                            showRegister: $showRegister,
                            showForgotPassword: $showForgotPassword
                        )
                    }

                    Spacer()
                }
                .padding()
            }
            .sheet(isPresented: $showForgotPassword) {
                ForgotPasswordView()
            }
        }
    }
}
