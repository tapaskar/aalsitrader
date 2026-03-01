package com.aalsitrader.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aalsitrader.android.model.*
import com.aalsitrader.android.network.WebSocketManager
import com.aalsitrader.android.repository.DashboardRepository
import com.aalsitrader.android.util.AgentDefinitions
import com.aalsitrader.android.util.Constants
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class DashboardViewModel : ViewModel() {
    private val repository = DashboardRepository()

    private val _agents = MutableStateFlow<List<Agent>>(emptyList())
    val agents: StateFlow<List<Agent>> = _agents.asStateFlow()

    private val _activities = MutableStateFlow<List<Activity>>(emptyList())
    val activities: StateFlow<List<Activity>> = _activities.asStateFlow()

    private val _comms = MutableStateFlow<List<CommMessage>>(emptyList())
    val comms: StateFlow<List<CommMessage>> = _comms.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _selectedFilter = MutableStateFlow<String?>(null)
    val selectedFilter: StateFlow<String?> = _selectedFilter.asStateFlow()

    init {
        loadAll()
        startPolling()
        connectWebSocket()
    }

    fun loadAll() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val activitiesResult = repository.getActivities()
                _activities.value = activitiesResult
                updateAgentsFromActivities(activitiesResult)
            } catch (e: Exception) {
                _error.value = e.message
            }
            try {
                _comms.value = repository.getComms()
            } catch (_: Exception) { }
            _isLoading.value = false
        }
    }

    fun setFilter(filter: String?) {
        _selectedFilter.value = if (_selectedFilter.value == filter) null else filter
    }

    fun clearError() {
        _error.value = null
    }

    private fun updateAgentsFromActivities(activities: List<Activity>) {
        val agentMap = mutableMapOf<String, Agent>()
        for (def in AgentDefinitions.all) {
            val recentActivity = activities.find { it.agentId == def.id }
            agentMap[def.id] = Agent(
                id = def.id,
                name = def.name,
                greek = def.greek,
                role = def.role,
                color = def.id,
                status = if (recentActivity != null) AgentStatus.active else def.defaultStatus,
                currentTask = recentActivity?.content,
                lastActivity = null,
            )
        }
        _agents.value = agentMap.values.toList()
    }

    private fun startPolling() {
        viewModelScope.launch {
            while (isActive) {
                delay(Constants.DASHBOARD_POLL_INTERVAL)
                try {
                    val activitiesResult = repository.getActivities()
                    _activities.value = activitiesResult
                    updateAgentsFromActivities(activitiesResult)
                    _comms.value = repository.getComms()
                } catch (_: Exception) { }
            }
        }
    }

    private fun connectWebSocket() {
        WebSocketManager.connect()
        viewModelScope.launch {
            WebSocketManager.messages.collect { msg ->
                try {
                    val type = msg["type"]?.jsonPrimitive?.content
                    if (type == "activity" || type == "new_activity") {
                        loadAll()
                    }
                } catch (_: Exception) { }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        WebSocketManager.disconnect()
    }
}
