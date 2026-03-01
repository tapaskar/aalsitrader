package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class Agent(
    val id: String,
    val name: String = "",
    val greek: String = "",
    val role: String = "",
    val color: String = "",
    val status: AgentStatus = AgentStatus.sleeping,
    val currentTask: String? = null,
    val lastActivity: String? = null,
    val stats: AgentStats? = null,
)

@Serializable
enum class AgentStatus { active, sleeping, error }

@Serializable
data class AgentStats(
    val tasksCompleted: Int? = null,
    val alertsSent: Int? = null,
    val accuracy: Double? = null,
)
