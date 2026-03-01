package com.aalsitrader.android.repository

import com.aalsitrader.android.model.*
import com.aalsitrader.android.network.*

class StraddleRepository {
    private val api = ApiClient.create<StraddleApi>()

    suspend fun getStatus() = api.getStatus()

    suspend fun getCapital(mode: String = "paper"): StraddleCapital =
        api.getCapital(mode).capital ?: StraddleCapital()

    suspend fun getCurrentPosition(mode: String = "paper"): StraddlePosition? =
        api.getCurrentPosition(mode).position

    suspend fun getTrades(from: String? = null, to: String? = null): List<StraddleTrade> =
        api.getTrades(from, to).trades

    suspend fun start(request: StraddleStartRequest) = api.start(request)
    suspend fun stop() = api.stop()
    suspend fun setMode(mode: String) = api.setMode(StraddleModeRequest(mode))
}
