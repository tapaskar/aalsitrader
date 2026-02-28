import Foundation
import SwiftUI

@Observable
final class AuthViewModel {
    static let shared = AuthViewModel()

    var isAuthenticated = false
    var user: User?
    var isLoading = false
    var error: String?

    private init() {
        if KeychainService.token != nil {
            isAuthenticated = true
            Task { await fetchProfile() }
        }
    }

    // MARK: - Auth Actions

    func login(email: String, password: String) async -> Bool {
        isLoading = true
        error = nil
        do {
            let response = try await AuthService.login(email: email, password: password)
            KeychainService.token = response.token
            await MainActor.run {
                self.user = response.user
                self.isAuthenticated = true
                self.isLoading = false
            }
            WebSocketManager.shared.connect()
            return true
        } catch let apiError as APIError {
            await MainActor.run {
                self.error = apiError.localizedDescription
                self.isLoading = false
            }
            return false
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                self.isLoading = false
            }
            return false
        }
    }

    func register(email: String, username: String, password: String) async -> Bool {
        isLoading = true
        error = nil
        do {
            let response = try await AuthService.register(email: email, username: username, password: password)
            KeychainService.token = response.token
            await MainActor.run {
                self.user = response.user
                self.isAuthenticated = true
                self.isLoading = false
            }
            WebSocketManager.shared.connect()
            return true
        } catch let apiError as APIError {
            await MainActor.run {
                self.error = apiError.localizedDescription
                self.isLoading = false
            }
            return false
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                self.isLoading = false
            }
            return false
        }
    }

    func fetchProfile() async {
        do {
            let response = try await AuthService.fetchProfile()
            await MainActor.run {
                self.user = response.user
            }
        } catch is APIError {
            await MainActor.run {
                self.logout()
            }
        } catch {}
    }

    func updateProfile(_ data: [String: Any]) async -> Bool {
        do {
            let response = try await AuthService.updateProfile(data)
            await MainActor.run {
                self.user = response.user
            }
            return true
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
            }
            return false
        }
    }

    func logout() {
        KeychainService.token = nil
        user = nil
        isAuthenticated = false
        WebSocketManager.shared.disconnect()
    }

    func clearError() {
        error = nil
    }
}
