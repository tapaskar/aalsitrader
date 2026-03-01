package com.aalsitrader.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aalsitrader.android.model.User
import com.aalsitrader.android.network.AdminStats
import com.aalsitrader.android.repository.AdminRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AdminViewModel : ViewModel() {
    private val repository = AdminRepository()

    private val _users = MutableStateFlow<List<User>>(emptyList())
    val users: StateFlow<List<User>> = _users.asStateFlow()

    private val _stats = MutableStateFlow<AdminStats?>(null)
    val stats: StateFlow<AdminStats?> = _stats.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    init {
        loadAll()
    }

    fun loadAll() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try { _users.value = repository.getUsers() } catch (e: Exception) { _error.value = e.message }
            try { _stats.value = repository.getStats() } catch (_: Exception) { }
            _isLoading.value = false
        }
    }

    fun setSearchQuery(query: String) { _searchQuery.value = query }

    fun updatePlan(email: String, plan: String, status: String) {
        viewModelScope.launch {
            try {
                repository.updatePlan(email, plan, status)
                _message.value = "Plan updated"
                loadAll()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun updateTrial(email: String, days: Int) {
        viewModelScope.launch {
            try {
                repository.updateTrial(email, days)
                _message.value = "Trial updated"
                loadAll()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun toggleTrading(email: String, enabled: Boolean) {
        viewModelScope.launch {
            try {
                repository.updateTrading(email, enabled)
                _message.value = if (enabled) "Trading enabled" else "Trading disabled"
                loadAll()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun toggleAccount(email: String, enabled: Boolean) {
        viewModelScope.launch {
            try {
                repository.updateAccount(email, enabled)
                _message.value = if (enabled) "Account enabled" else "Account disabled"
                loadAll()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun clearError() { _error.value = null }
    fun clearMessage() { _message.value = null }

    fun filteredUsers(): List<User> {
        val query = _searchQuery.value
        return if (query.isBlank()) _users.value
        else _users.value.filter {
            it.email.contains(query, ignoreCase = true) ||
                    it.username.contains(query, ignoreCase = true)
        }
    }
}
