package com.aalsitrader.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aalsitrader.android.model.TradingRules
import com.aalsitrader.android.repository.TradingRulesRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class TradingRulesViewModel : ViewModel() {
    private val repository = TradingRulesRepository()

    private val _rules = MutableStateFlow<TradingRules?>(null)
    val rules: StateFlow<TradingRules?> = _rules.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    init {
        loadRules()
    }

    fun loadRules() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                _rules.value = repository.getRules()
            } catch (e: Exception) {
                _error.value = e.message
            }
            _isLoading.value = false
        }
    }

    fun saveRules(rules: TradingRules) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                _rules.value = repository.updateRules(rules)
                _message.value = "Rules saved"
            } catch (e: Exception) {
                _error.value = e.message
            }
            _isLoading.value = false
        }
    }

    fun clearError() { _error.value = null }
    fun clearMessage() { _message.value = null }
}
