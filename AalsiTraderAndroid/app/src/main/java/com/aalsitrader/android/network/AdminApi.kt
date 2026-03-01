package com.aalsitrader.android.network

import com.aalsitrader.android.model.User
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import retrofit2.http.*

@Serializable
data class PlanUpdateRequest(val plan: String, val planStatus: String)

@Serializable
data class TrialUpdateRequest(val trialDays: Int)

@Serializable
data class TradingUpdateRequest(val liveTradingEnabled: Boolean)

@Serializable
data class AccountUpdateRequest(val accountEnabled: Boolean)

@Serializable
data class AdminStats(
    val totalUsers: Int = 0,
    val activeUsers: Int = 0,
    val trialUsers: Int = 0,
    val paidUsers: Int = 0,
    val totalTrades: Int = 0,
    val activeTrades: Int = 0,
)

interface AdminApi {
    @GET("admin/users")
    suspend fun getUsers(): List<User>

    @GET("admin/stats")
    suspend fun getStats(): AdminStats

    @PUT("admin/users/{email}/plan")
    suspend fun updatePlan(@Path("email") email: String, @Body request: PlanUpdateRequest): MessageResponse

    @PUT("admin/users/{email}/trial")
    suspend fun updateTrial(@Path("email") email: String, @Body request: TrialUpdateRequest): MessageResponse

    @PUT("admin/users/{email}/trading")
    suspend fun updateTrading(@Path("email") email: String, @Body request: TradingUpdateRequest): MessageResponse

    @PUT("admin/users/{email}/account")
    suspend fun updateAccount(@Path("email") email: String, @Body request: AccountUpdateRequest): MessageResponse

    @DELETE("admin/users/{email}")
    suspend fun deleteUser(@Path("email") email: String): MessageResponse
}
