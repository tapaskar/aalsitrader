package com.aalsitrader.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aalsitrader.android.model.*
import com.aalsitrader.android.network.StraddleStartRequest
import com.aalsitrader.android.repository.StraddleRepository
import com.aalsitrader.android.util.Constants
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class StraddleViewModel : ViewModel() {
    private val repository = StraddleRepository()

    private val _status = MutableStateFlow<EngineStatus?>(null)
    val status: StateFlow<EngineStatus?> = _status.asStateFlow()

    private val _capital = MutableStateFlow<StraddleCapital?>(null)
    val capital: StateFlow<StraddleCapital?> = _capital.asStateFlow()

    private val _position = MutableStateFlow<StraddlePosition?>(null)
    val position: StateFlow<StraddlePosition?> = _position.asStateFlow()

    private val _trades = MutableStateFlow<List<StraddleTrade>>(emptyList())
    val trades: StateFlow<List<StraddleTrade>> = _trades.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    init {
        loadAll()
        startPolling()
    }

    fun loadAll() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try { _status.value = repository.getStatus() } catch (_: Exception) { }
            try { _capital.value = repository.getCapital() } catch (_: Exception) { }
            try { _position.value = repository.getCurrentPosition() } catch (_: Exception) { }
            try { _trades.value = repository.getTrades() } catch (_: Exception) { }
            _isLoading.value = false
        }
    }

    fun startEngine(
        indexName: String = "NIFTY",
        strategyType: String = "short_straddle",
        mode: String = "paper",
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.start(StraddleStartRequest(indexName, strategyType, mode))
                _message.value = "Engine started"
                loadAll()
            } catch (e: Exception) {
                _error.value = e.message
            }
            _isLoading.value = false
        }
    }

    fun stopEngine() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.stop()
                _message.value = "Engine stopped"
                loadAll()
            } catch (e: Exception) {
                _error.value = e.message
            }
            _isLoading.value = false
        }
    }

    fun clearError() { _error.value = null }
    fun clearMessage() { _message.value = null }

    private fun startPolling() {
        viewModelScope.launch {
            while (isActive) {
                delay(Constants.STRADDLE_POLL_INTERVAL)
                try { _status.value = repository.getStatus() } catch (_: Exception) { }
                try { _position.value = repository.getCurrentPosition() } catch (_: Exception) { }
            }
        }
    }
}
