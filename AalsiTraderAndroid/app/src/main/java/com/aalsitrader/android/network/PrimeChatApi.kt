package com.aalsitrader.android.network

import kotlinx.serialization.Serializable
import com.aalsitrader.android.model.ActivityTimestamp
import retrofit2.http.*

@Serializable
data class ChatMessage(
    val id: String,
    val role: ChatRole = ChatRole.user,
    val content: String = "",
    val timestamp: ActivityTimestamp = ActivityTimestamp.Epoch(0.0),
    val intent: String? = null,
)

@Serializable
enum class ChatRole { user, assistant }

@Serializable
data class ChatSendRequest(val message: String)

@Serializable
data class ChatResponse(
    val reply: String? = null,
    val message: String? = null,
)

interface PrimeChatApi {
    @GET("prime/chat/history")
    suspend fun getHistory(@Query("limit") limit: Int = 50): List<ChatMessage>

    @POST("prime/chat")
    suspend fun sendMessage(@Body request: ChatSendRequest): ChatResponse
}
