package com.aalsitrader.android.repository

import com.aalsitrader.android.model.Activity
import com.aalsitrader.android.model.CommMessage
import com.aalsitrader.android.model.MarketDataResponse
import com.aalsitrader.android.network.ApiClient
import com.aalsitrader.android.network.DashboardApi

class DashboardRepository {
    private val api = ApiClient.create<DashboardApi>()

    suspend fun getActivities(): List<Activity> = api.getActivities().activities
    suspend fun getComms(): List<CommMessage> = api.getComms().comms
    suspend fun getMarketData(): MarketDataResponse = api.getMarketData()
}
