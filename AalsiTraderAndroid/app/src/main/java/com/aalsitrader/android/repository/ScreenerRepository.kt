package com.aalsitrader.android.repository

import com.aalsitrader.android.model.CandleData
import com.aalsitrader.android.model.SmartMoneyStock
import com.aalsitrader.android.network.ApiClient
import com.aalsitrader.android.network.ScreenerApi

class ScreenerRepository {
    private val api = ApiClient.create<ScreenerApi>()

    suspend fun getStocks(force: Boolean = false): List<SmartMoneyStock> =
        api.getStocks(if (force) 1 else 0).stocks

    suspend fun getChart(symbol: String): List<CandleData> = api.getChart(symbol).candles
}
