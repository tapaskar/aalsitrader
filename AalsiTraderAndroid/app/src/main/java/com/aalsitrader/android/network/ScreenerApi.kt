package com.aalsitrader.android.network

import com.aalsitrader.android.model.CandleData
import com.aalsitrader.android.model.SmartMoneyStock
import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Query

@Serializable
data class ScreenerResponse(
    val stocks: List<SmartMoneyStock> = emptyList(),
    val cached: Boolean? = null,
    val fetchedAt: Long? = null,
    val count: Int? = null,
    val marketOpen: Boolean? = null,
)

@Serializable
data class ChartResponse(
    val symbol: String = "",
    val candles: List<CandleData> = emptyList(),
)

interface ScreenerApi {
    @GET("screener")
    suspend fun getStocks(@Query("force") force: Int = 0): ScreenerResponse

    @GET("screener/chart")
    suspend fun getChart(@Query("symbol") symbol: String): ChartResponse
}
