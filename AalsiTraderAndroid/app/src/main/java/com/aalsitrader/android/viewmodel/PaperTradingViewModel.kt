package com.aalsitrader.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aalsitrader.android.model.*
import com.aalsitrader.android.repository.PaperTradingRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class PaperTradingViewModel : ViewModel() {
    private val repository = PaperTradingRepository()

    private val _portfolio = MutableStateFlow<PaperPortfolio?>(null)
    val portfolio: StateFlow<PaperPortfolio?> = _portfolio.asStateFlow()

    private val _trades = MutableStateFlow<List<PaperTrade>>(emptyList())
    val trades: StateFlow<List<PaperTrade>> = _trades.asStateFlow()

    private val _metrics = MutableStateFlow<PaperMetrics?>(null)
    val metrics: StateFlow<PaperMetrics?> = _metrics.asStateFlow()

    private val _equityCurve = MutableStateFlow<List<EquityPoint>>(emptyList())
    val equityCurve: StateFlow<List<EquityPoint>> = _equityCurve.asStateFlow()

    private val _approvals = MutableStateFlow<List<SigmaApproval>>(emptyList())
    val approvals: StateFlow<List<SigmaApproval>> = _approvals.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _selectedTab = MutableStateFlow(0)
    val selectedTab: StateFlow<Int> = _selectedTab.asStateFlow()

    private val _mode = MutableStateFlow("paper")
    val mode: StateFlow<String> = _mode.asStateFlow()

    init {
        loadAll()
    }

    fun setTab(tab: Int) {
        _selectedTab.value = tab
    }

    fun loadAll() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            val m = _mode.value
            try {
                _portfolio.value = repository.getPortfolio(m)
            } catch (_: Exception) { }
            try {
                _trades.value = repository.getTrades(mode = m)
            } catch (_: Exception) { }
            try {
                _metrics.value = repository.getMetrics(m)
            } catch (_: Exception) { }
            try {
                _equityCurve.value = repository.getEquityCurve(mode = m)
            } catch (_: Exception) { }
            try {
                _approvals.value = repository.getApprovals()
            } catch (_: Exception) { }
            _isLoading.value = false
        }
    }

    fun approveTrade(tradeId: String) {
        viewModelScope.launch {
            try {
                repository.approveTrade(tradeId)
                _approvals.value = _approvals.value.map {
                    if (it.tradeId == tradeId) it.copy(status = ApprovalStatus.approved) else it
                }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    fun rejectTrade(tradeId: String) {
        viewModelScope.launch {
            try {
                repository.rejectTrade(tradeId)
                _approvals.value = _approvals.value.map {
                    if (it.tradeId == tradeId) it.copy(status = ApprovalStatus.rejected) else it
                }
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }

    fun toggleMode() {
        val newMode = if (_mode.value == "paper") "live" else "paper"
        _mode.value = newMode
        loadAll()
    }

    fun clearError() {
        _error.value = null
    }
}
