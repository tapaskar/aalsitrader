package com.aalsitrader.android.repository

import com.aalsitrader.android.model.User
import com.aalsitrader.android.network.*

class AuthRepository {
    private val api = ApiClient.create<AuthApi>()

    suspend fun login(email: String, password: String): AuthResponse {
        return api.login(LoginRequest(email, password))
    }

    suspend fun register(email: String, username: String, password: String): AuthResponse {
        return api.register(RegisterRequest(email, username, password))
    }

    suspend fun getProfile(): User {
        return api.getProfile()
    }

    suspend fun updateProfile(request: ProfileUpdateRequest): User {
        return api.updateProfile(request)
    }

    suspend fun forgotPassword(email: String): MessageResponse {
        return api.forgotPassword(ForgotPasswordRequest(email))
    }

    suspend fun resetPassword(email: String, resetToken: String, newPassword: String): MessageResponse {
        return api.resetPassword(ResetPasswordRequest(email, resetToken, newPassword))
    }
}
