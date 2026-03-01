package com.aalsitrader.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aalsitrader.android.model.ActivityTimestamp
import com.aalsitrader.android.network.ChatMessage
import com.aalsitrader.android.network.ChatRole
import com.aalsitrader.android.repository.PrimeChatRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

class PrimeChatViewModel : ViewModel() {
    private val repository = PrimeChatRepository()

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isSending = MutableStateFlow(false)
    val isSending: StateFlow<Boolean> = _isSending.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init {
        loadHistory()
    }

    fun loadHistory() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                _messages.value = repository.getHistory()
            } catch (e: Exception) {
                _error.value = e.message
            }
            _isLoading.value = false
        }
    }

    fun sendMessage(content: String) {
        if (content.isBlank()) return
        viewModelScope.launch {
            _isSending.value = true
            // Add user message locally
            val userMsg = ChatMessage(
                id = UUID.randomUUID().toString(),
                role = ChatRole.user,
                content = content,
                timestamp = ActivityTimestamp.Epoch(System.currentTimeMillis() / 1000.0),
            )
            _messages.value = _messages.value + userMsg

            try {
                val response = repository.sendMessage(content)
                val reply = response.reply ?: response.message ?: "No response"
                val assistantMsg = ChatMessage(
                    id = UUID.randomUUID().toString(),
                    role = ChatRole.assistant,
                    content = reply,
                    timestamp = ActivityTimestamp.Epoch(System.currentTimeMillis() / 1000.0),
                )
                _messages.value = _messages.value + assistantMsg
            } catch (e: Exception) {
                _error.value = e.message
            }
            _isSending.value = false
        }
    }

    fun clearError() { _error.value = null }
}
