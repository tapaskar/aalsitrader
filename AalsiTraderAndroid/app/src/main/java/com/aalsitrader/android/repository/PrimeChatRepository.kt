package com.aalsitrader.android.repository

import com.aalsitrader.android.network.*

class PrimeChatRepository {
    private val api = ApiClient.create<PrimeChatApi>()

    suspend fun getHistory(limit: Int = 50) = api.getHistory(limit)
    suspend fun sendMessage(message: String) = api.sendMessage(ChatSendRequest(message))
}
