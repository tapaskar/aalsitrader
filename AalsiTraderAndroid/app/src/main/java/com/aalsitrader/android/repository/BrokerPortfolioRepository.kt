package com.aalsitrader.android.repository

import com.aalsitrader.android.network.ApiClient
import com.aalsitrader.android.network.BrokerPortfolioApi

class BrokerPortfolioRepository {
    private val api = ApiClient.create<BrokerPortfolioApi>()

    suspend fun getPortfolio() = api.getPortfolio()
}
