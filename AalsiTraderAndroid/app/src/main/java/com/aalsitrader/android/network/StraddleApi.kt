package com.aalsitrader.android.network

import com.aalsitrader.android.model.*
import kotlinx.serialization.Serializable
import retrofit2.http.*

@Serializable
data class StraddleStartRequest(
    val indexName: String = "NIFTY",
    val strategyType: String = "short_straddle",
    val mode: String = "paper",
)

@Serializable
data class StraddleModeRequest(val mode: String)

@Serializable
data class StraddlePositionResponse(val position: StraddlePosition? = null)

@Serializable
data class StraddleCapitalResponse(val capital: StraddleCapital? = null)

@Serializable
data class StraddleTradesResponse(val trades: List<StraddleTrade> = emptyList())

interface StraddleApi {
    @GET("nifty-straddle/status")
    suspend fun getStatus(): EngineStatus

    @GET("nifty-straddle/capital")
    suspend fun getCapital(@Query("mode") mode: String = "paper"): StraddleCapitalResponse

    @GET("nifty-straddle/current")
    suspend fun getCurrentPosition(@Query("mode") mode: String = "paper"): StraddlePositionResponse

    @GET("nifty-straddle/trades")
    suspend fun getTrades(
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
    ): StraddleTradesResponse

    @POST("nifty-straddle/start")
    suspend fun start(@Body request: StraddleStartRequest): MessageResponse

    @POST("nifty-straddle/stop")
    suspend fun stop(): MessageResponse

    @POST("nifty-straddle/mode")
    suspend fun setMode(@Body request: StraddleModeRequest): MessageResponse
}
