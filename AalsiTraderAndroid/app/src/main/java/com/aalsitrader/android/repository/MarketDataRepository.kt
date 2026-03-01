package com.aalsitrader.android.repository

import com.aalsitrader.android.model.MarketDataResponse
import com.aalsitrader.android.network.ApiClient
import com.aalsitrader.android.network.DashboardApi

class MarketDataRepository {
    private val api = ApiClient.create<DashboardApi>()

    suspend fun getMarketData(): MarketDataResponse = api.getMarketData()
}
