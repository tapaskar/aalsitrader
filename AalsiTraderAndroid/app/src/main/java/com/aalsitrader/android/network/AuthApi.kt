package com.aalsitrader.android.network

import com.aalsitrader.android.model.User
import kotlinx.serialization.Serializable
import retrofit2.http.*

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class RegisterRequest(val email: String, val username: String, val password: String)

@Serializable
data class ForgotPasswordRequest(val email: String)

@Serializable
data class ResetPasswordRequest(val email: String, val resetToken: String, val newPassword: String)

@Serializable
data class AuthResponse(val token: String? = null, val user: User? = null, val message: String? = null)

@Serializable
data class MessageResponse(val message: String? = null)

@Serializable
data class ProfileUpdateRequest(
    val username: String? = null,
    val emailOptOut: Boolean? = null,
    val settings: com.aalsitrader.android.model.UserSettings? = null,
)

interface AuthApi {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): AuthResponse

    @GET("auth/profile")
    suspend fun getProfile(): User

    @PUT("auth/profile")
    suspend fun updateProfile(@Body request: ProfileUpdateRequest): User

    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body request: ForgotPasswordRequest): MessageResponse

    @POST("auth/reset-password")
    suspend fun resetPassword(@Body request: ResetPasswordRequest): MessageResponse
}
