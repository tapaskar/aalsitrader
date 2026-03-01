package com.aalsitrader.android.repository

import com.aalsitrader.android.network.*

class AdminRepository {
    private val api = ApiClient.create<AdminApi>()

    suspend fun getUsers() = api.getUsers()
    suspend fun getStats() = api.getStats()
    suspend fun updatePlan(email: String, plan: String, planStatus: String) =
        api.updatePlan(email, PlanUpdateRequest(plan, planStatus))
    suspend fun updateTrial(email: String, days: Int) =
        api.updateTrial(email, TrialUpdateRequest(days))
    suspend fun updateTrading(email: String, enabled: Boolean) =
        api.updateTrading(email, TradingUpdateRequest(enabled))
    suspend fun updateAccount(email: String, enabled: Boolean) =
        api.updateAccount(email, AccountUpdateRequest(enabled))
    suspend fun deleteUser(email: String) = api.deleteUser(email)
}
