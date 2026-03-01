package com.aalsitrader.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aalsitrader.android.model.*
import com.aalsitrader.android.repository.ScreenerRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ScreenerViewModel : ViewModel() {
    private val repository = ScreenerRepository()

    private val _stocks = MutableStateFlow<List<SmartMoneyStock>>(emptyList())
    val stocks: StateFlow<List<SmartMoneyStock>> = _stocks.asStateFlow()

    private val _chartData = MutableStateFlow<List<CandleData>>(emptyList())
    val chartData: StateFlow<List<CandleData>> = _chartData.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _signalFilter = MutableStateFlow<StockSignal?>(null)
    val signalFilter: StateFlow<StockSignal?> = _signalFilter.asStateFlow()

    private val _sortBy = MutableStateFlow(ScreenerSort.CONFIDENCE)
    val sortBy: StateFlow<ScreenerSort> = _sortBy.asStateFlow()

    init {
        loadStocks()
    }

    fun loadStocks(force: Boolean = false) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                _stocks.value = repository.getStocks(force)
            } catch (e: Exception) {
                _error.value = e.message
            }
            _isLoading.value = false
        }
    }

    fun loadChart(symbol: String) {
        viewModelScope.launch {
            try {
                _chartData.value = repository.getChart(symbol)
            } catch (_: Exception) {
                _chartData.value = emptyList()
            }
        }
    }

    fun setSearchQuery(query: String) { _searchQuery.value = query }
    fun setSignalFilter(signal: StockSignal?) { _signalFilter.value = if (_signalFilter.value == signal) null else signal }
    fun setSortBy(sort: ScreenerSort) { _sortBy.value = sort }
    fun clearError() { _error.value = null }

    fun filteredStocks(): List<SmartMoneyStock> {
        var result = _stocks.value
        val query = _searchQuery.value
        if (query.isNotBlank()) {
            result = result.filter { it.symbol.contains(query, ignoreCase = true) }
        }
        _signalFilter.value?.let { filter ->
            result = result.filter { it.signal == filter }
        }
        result = when (_sortBy.value) {
            ScreenerSort.CONFIDENCE -> result.sortedByDescending { it.confidence }
            ScreenerSort.TREND_STRENGTH -> result.sortedByDescending { it.trendStrength }
            ScreenerSort.RSI -> result.sortedBy { it.rsi }
            ScreenerSort.PRICE -> result.sortedByDescending { it.price }
        }
        return result
    }
}

enum class ScreenerSort { CONFIDENCE, TREND_STRENGTH, RSI, PRICE }
