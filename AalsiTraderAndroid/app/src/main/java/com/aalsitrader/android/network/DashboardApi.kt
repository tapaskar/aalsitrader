package com.aalsitrader.android.network

import com.aalsitrader.android.model.Activity
import com.aalsitrader.android.model.CommMessage
import com.aalsitrader.android.model.MarketDataResponse
import kotlinx.serialization.Serializable
import retrofit2.http.GET

@Serializable
data class ActivitiesResponse(val activities: List<Activity> = emptyList())

@Serializable
data class CommsResponse(val comms: List<CommMessage> = emptyList())

interface DashboardApi {
    @GET("activities")
    suspend fun getActivities(): ActivitiesResponse

    @GET("comms")
    suspend fun getComms(): CommsResponse

    @GET("market-data")
    suspend fun getMarketData(): MarketDataResponse
}
