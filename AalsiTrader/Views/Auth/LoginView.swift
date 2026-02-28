import SwiftUI

struct LoginView: View {
    @Binding var showRegister: Bool
    @Binding var showForgotPassword: Bool
    @State private var auth = AuthViewModel.shared
    @State private var email = ""
    @State private var password = ""

    private var isFormValid: Bool {
        !email.isEmpty && password.count >= 8
    }

    var body: some View {
        VStack(spacing: 16) {
            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .textFieldStyle(.plain)
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.appBorder.opacity(0.5), lineWidth: 1)
                    )

                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .textFieldStyle(.plain)
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.appBorder.opacity(0.5), lineWidth: 1)
                    )
            }

            if let error = auth.error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Color.statusDanger)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task {
                    await auth.login(email: email, password: password)
                }
            } label: {
                if auth.isLoading {
                    ProgressView()
                        .tint(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                } else {
                    Text("Login")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.accentCyan)
            .disabled(!isFormValid || auth.isLoading)

            HStack {
                Button("Forgot Password?") {
                    showForgotPassword = true
                }
                .font(.subheadline)
                .foregroundStyle(Color.accentCyan)

                Spacer()

                Button("Create Account") {
                    withAnimation { showRegister = true }
                }
                .font(.subheadline)
                .foregroundStyle(Color.accentCyan)
            }
        }
        .foregroundStyle(.white)
    }
}
