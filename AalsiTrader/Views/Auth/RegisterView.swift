import SwiftUI

struct RegisterView: View {
    @Binding var showRegister: Bool
    @State private var auth = AuthViewModel.shared
    @State private var email = ""
    @State private var username = ""
    @State private var password = ""
    @State private var confirmPassword = ""

    private var isFormValid: Bool {
        !email.isEmpty && !username.isEmpty && password.count >= 8 && password == confirmPassword
    }

    private var passwordMismatch: Bool {
        !confirmPassword.isEmpty && password != confirmPassword
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
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.appBorder.opacity(0.5)))

                TextField("Username", text: $username)
                    .textContentType(.username)
                    .autocapitalization(.none)
                    .textFieldStyle(.plain)
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.appBorder.opacity(0.5)))

                SecureField("Password (8+ chars)", text: $password)
                    .textContentType(.newPassword)
                    .textFieldStyle(.plain)
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.appBorder.opacity(0.5)))

                SecureField("Confirm Password", text: $confirmPassword)
                    .textFieldStyle(.plain)
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(passwordMismatch ? Color.statusDanger : Color.appBorder.opacity(0.5)))
            }

            if passwordMismatch {
                Text("Passwords don't match")
                    .font(.caption)
                    .foregroundStyle(Color.statusDanger)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if let error = auth.error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Color.statusDanger)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task {
                    await auth.register(email: email, username: username, password: password)
                }
            } label: {
                if auth.isLoading {
                    ProgressView().tint(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                } else {
                    Text("Create Account")
                        .font(.headline)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.accentCyan)
            .disabled(!isFormValid || auth.isLoading)

            Button("Already have an account? Login") {
                withAnimation { showRegister = false }
            }
            .font(.subheadline)
            .foregroundStyle(Color.accentCyan)
        }
        .foregroundStyle(.white)
    }
}
