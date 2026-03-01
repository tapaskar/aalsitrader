package com.aalsitrader.android.network

import com.aalsitrader.android.model.*
import kotlinx.serialization.Serializable
import retrofit2.http.*

@Serializable
data class PaperModeRequest(val mode: String)

@Serializable
data class PortfolioResponse(val portfolio: PaperPortfolio? = null)

@Serializable
data class TradesResponse(val trades: List<PaperTrade> = emptyList())

@Serializable
data class EquityCurveResponse(
    val equityCurve: List<EquityPoint>? = null,
    val curve: List<EquityPoint>? = null,
) {
    val points: List<EquityPoint> get() = equityCurve ?: curve ?: emptyList()
}

@Serializable
data class ApprovalsResponse(
    val pending: List<SigmaApproval> = emptyList(),
    val count: Int = 0,
)

interface PaperTradingApi {
    @GET("paper-portfolio")
    suspend fun getPortfolio(@Query("mode") mode: String = "paper"): PortfolioResponse

    @GET("paper-trades")
    suspend fun getTrades(
        @Query("limit") limit: Int = 100,
        @Query("mode") mode: String = "paper",
    ): TradesResponse

    @GET("paper-metrics")
    suspend fun getMetrics(@Query("mode") mode: String = "paper"): PaperMetrics

    @GET("paper-equity-curve")
    suspend fun getEquityCurve(
        @Query("days") days: Int = 30,
        @Query("mode") mode: String = "paper",
    ): EquityCurveResponse

    @GET("sigma-approvals")
    suspend fun getApprovals(): ApprovalsResponse

    @POST("sigma-approvals/{tradeId}/approve")
    suspend fun approveTrade(@Path("tradeId") tradeId: String): MessageResponse

    @POST("sigma-approvals/{tradeId}/reject")
    suspend fun rejectTrade(@Path("tradeId") tradeId: String): MessageResponse

    @GET("paper-mode")
    suspend fun getMode(): MessageResponse

    @POST("paper-mode")
    suspend fun setMode(@Body request: PaperModeRequest): MessageResponse
}
