package com.aalsitrader.android.repository

import com.aalsitrader.android.model.TradingRules
import com.aalsitrader.android.network.ApiClient
import com.aalsitrader.android.network.TradingRulesApi

class TradingRulesRepository {
    private val api = ApiClient.create<TradingRulesApi>()

    suspend fun getRules() = api.getRules()
    suspend fun updateRules(rules: TradingRules) = api.updateRules(rules)
}
