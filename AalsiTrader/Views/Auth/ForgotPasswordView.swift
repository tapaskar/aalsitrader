import SwiftUI

struct ForgotPasswordView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var step: ResetStep = .requestCode
    @State private var email = ""
    @State private var resetToken = ""
    @State private var newPassword = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var success = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                VStack(spacing: 20) {
                    if step == .requestCode {
                        Text("Enter your email to receive a reset code")
                            .font(.subheadline)
                            .foregroundStyle(Color.textSecondary)

                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .textFieldStyle(.plain)
                            .padding()
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.appBorder.opacity(0.5)))

                        Button {
                            Task { await requestCode() }
                        } label: {
                            if isLoading {
                                ProgressView().tint(.white).frame(maxWidth: .infinity).padding(.vertical, 14)
                            } else {
                                Text("Send Reset Code").font(.headline)
                                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                            }
                        }
                        .buttonStyle(.borderedProminent).tint(Color.accentCyan)
                        .disabled(email.isEmpty || isLoading)

                    } else {
                        Text("Enter the reset code and your new password")
                            .font(.subheadline)
                            .foregroundStyle(Color.textSecondary)

                        TextField("Reset Code", text: $resetToken)
                            .textFieldStyle(.plain).padding()
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.appBorder.opacity(0.5)))

                        SecureField("New Password (8+ chars)", text: $newPassword)
                            .textFieldStyle(.plain).padding()
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.appBorder.opacity(0.5)))

                        Button {
                            Task { await resetPassword() }
                        } label: {
                            if isLoading {
                                ProgressView().tint(.white).frame(maxWidth: .infinity).padding(.vertical, 14)
                            } else {
                                Text("Reset Password").font(.headline)
                                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                            }
                        }
                        .buttonStyle(.borderedProminent).tint(Color.accentCyan)
                        .disabled(resetToken.isEmpty || newPassword.count < 8 || isLoading)
                    }

                    if let error {
                        Text(error).font(.caption).foregroundStyle(Color.statusDanger)
                    }

                    if success {
                        Text("Password reset successful! You can now login.")
                            .font(.caption).foregroundStyle(Color.statusActive)
                    }

                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Reset Password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.accentCyan)
                }
            }
            .foregroundStyle(.white)
        }
    }

    private func requestCode() async {
        isLoading = true
        error = nil
        do {
            let response = try await AuthService.forgotPassword(email: email)
            if let token = response.resetToken {
                resetToken = token
            }
            step = .enterCode
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func resetPassword() async {
        isLoading = true
        error = nil
        do {
            _ = try await AuthService.resetPassword(email: email, resetToken: resetToken, newPassword: newPassword)
            success = true
            try? await Task.sleep(for: .seconds(2))
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

private enum ResetStep {
    case requestCode, enterCode
}
