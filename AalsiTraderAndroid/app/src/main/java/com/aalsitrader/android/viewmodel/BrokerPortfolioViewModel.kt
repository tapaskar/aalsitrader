package com.aalsitrader.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aalsitrader.android.model.BrokerPortfolio
import com.aalsitrader.android.repository.BrokerPortfolioRepository
import com.aalsitrader.android.util.Constants
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class BrokerPortfolioViewModel : ViewModel() {
    private val repository = BrokerPortfolioRepository()

    private val _portfolio = MutableStateFlow<BrokerPortfolio?>(null)
    val portfolio: StateFlow<BrokerPortfolio?> = _portfolio.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init {
        loadPortfolio()
        startPolling()
    }

    fun loadPortfolio() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                _portfolio.value = repository.getPortfolio()
            } catch (e: Exception) {
                _error.value = e.message
            }
            _isLoading.value = false
        }
    }

    fun clearError() { _error.value = null }

    private fun startPolling() {
        viewModelScope.launch {
            while (isActive) {
                delay(Constants.BROKER_POLL_INTERVAL)
                try { _portfolio.value = repository.getPortfolio() } catch (_: Exception) { }
            }
        }
    }
}
