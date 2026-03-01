package com.aalsitrader.android.network

import com.aalsitrader.android.model.TradingRules
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PUT

interface TradingRulesApi {
    @GET("trading-rules")
    suspend fun getRules(): TradingRules

    @PUT("trading-rules")
    suspend fun updateRules(@Body rules: TradingRules): TradingRules
}
