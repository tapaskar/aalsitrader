package com.aalsitrader.android.repository

import com.aalsitrader.android.model.*
import com.aalsitrader.android.network.ApiClient
import com.aalsitrader.android.network.PaperModeRequest
import com.aalsitrader.android.network.PaperTradingApi

class PaperTradingRepository {
    private val api = ApiClient.create<PaperTradingApi>()

    suspend fun getPortfolio(mode: String = "paper"): PaperPortfolio =
        api.getPortfolio(mode).portfolio ?: PaperPortfolio()

    suspend fun getTrades(limit: Int = 100, mode: String = "paper"): List<PaperTrade> =
        api.getTrades(limit, mode).trades

    suspend fun getMetrics(mode: String = "paper"): PaperMetrics = api.getMetrics(mode)

    suspend fun getEquityCurve(days: Int = 30, mode: String = "paper"): List<EquityPoint> =
        api.getEquityCurve(days, mode).points

    suspend fun getApprovals(): List<SigmaApproval> = api.getApprovals().pending

    suspend fun approveTrade(tradeId: String) = api.approveTrade(tradeId)
    suspend fun rejectTrade(tradeId: String) = api.rejectTrade(tradeId)
    suspend fun setMode(mode: String) = api.setMode(PaperModeRequest(mode))
}
