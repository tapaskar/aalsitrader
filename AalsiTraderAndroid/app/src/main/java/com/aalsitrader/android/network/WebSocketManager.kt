package com.aalsitrader.android.network

import com.aalsitrader.android.util.Constants
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import okhttp3.*

object WebSocketManager {
    private var webSocket: WebSocket? = null
    private var isConnected = false
    private var reconnectJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val _messages = MutableSharedFlow<JsonObject>(replay = 0, extraBufferCapacity = 64)
    val messages: SharedFlow<JsonObject> = _messages.asSharedFlow()

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    fun connect() {
        if (isConnected) return
        val token = TokenManager.getToken() ?: return

        val request = Request.Builder()
            .url("${Constants.WS_BASE_URL}?token=$token")
            .build()

        webSocket = ApiClient.okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                isConnected = true
                reconnectJob?.cancel()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val obj = json.decodeFromString<JsonObject>(text)
                    scope.launch { _messages.emit(obj) }
                } catch (_: Exception) { }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                isConnected = false
                scheduleReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                isConnected = false
            }
        })
    }

    fun disconnect() {
        reconnectJob?.cancel()
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
        isConnected = false
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(Constants.WS_RECONNECT_DELAY)
            connect()
        }
    }
}
