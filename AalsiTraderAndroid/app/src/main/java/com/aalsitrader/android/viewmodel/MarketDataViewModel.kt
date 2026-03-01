package com.aalsitrader.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aalsitrader.android.model.NamedMarketIndex
import com.aalsitrader.android.repository.MarketDataRepository
import com.aalsitrader.android.util.Constants
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class MarketDataViewModel : ViewModel() {
    private val repository = MarketDataRepository()

    private val _indices = MutableStateFlow<List<NamedMarketIndex>>(emptyList())
    val indices: StateFlow<List<NamedMarketIndex>> = _indices.asStateFlow()

    private val _marketOpen = MutableStateFlow(false)
    val marketOpen: StateFlow<Boolean> = _marketOpen.asStateFlow()

    init {
        loadMarketData()
        startPolling()
    }

    fun loadMarketData() {
        viewModelScope.launch {
            try {
                val response = repository.getMarketData()
                _indices.value = response.toIndexList()
                _marketOpen.value = response.marketOpen ?: false
            } catch (_: Exception) { }
        }
    }

    private fun startPolling() {
        viewModelScope.launch {
            while (isActive) {
                delay(Constants.DASHBOARD_POLL_INTERVAL)
                loadMarketData()
            }
        }
    }
}
