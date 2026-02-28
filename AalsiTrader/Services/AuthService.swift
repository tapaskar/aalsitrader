import Foundation

enum AuthService {
    struct LoginResponse: Decodable {
        let token: String
        let user: User
    }

    struct RegisterResponse: Decodable {
        let token: String
        let user: User
    }

    struct ProfileResponse: Decodable {
        let user: User
    }

    struct ForgotPasswordResponse: Decodable {
        let resetToken: String?
        let message: String?
    }

    struct ResetPasswordResponse: Decodable {
        let message: String?
    }

    static func login(email: String, password: String) async throws -> LoginResponse {
        try await APIClient.shared.post("/auth/login", body: [
            "email": email,
            "password": password
        ])
    }

    static func register(email: String, username: String, password: String) async throws -> RegisterResponse {
        try await APIClient.shared.post("/auth/register", body: [
            "email": email,
            "username": username,
            "password": password
        ])
    }

    static func fetchProfile() async throws -> ProfileResponse {
        try await APIClient.shared.get("/auth/profile")
    }

    static func updateProfile(_ data: [String: Any]) async throws -> ProfileResponse {
        try await APIClient.shared.put("/auth/profile", body: data)
    }

    static func forgotPassword(email: String) async throws -> ForgotPasswordResponse {
        try await APIClient.shared.post("/auth/forgot-password", body: [
            "email": email
        ])
    }

    static func resetPassword(email: String, resetToken: String, newPassword: String) async throws -> ResetPasswordResponse {
        try await APIClient.shared.post("/auth/reset-password", body: [
            "email": email,
            "resetToken": resetToken,
            "newPassword": newPassword
        ])
    }
}
