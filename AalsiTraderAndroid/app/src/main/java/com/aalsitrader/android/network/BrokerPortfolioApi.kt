package com.aalsitrader.android.network

import com.aalsitrader.android.model.BrokerPortfolio
import retrofit2.http.GET

interface BrokerPortfolioApi {
    @GET("broker-portfolio")
    suspend fun getPortfolio(): BrokerPortfolio
}
