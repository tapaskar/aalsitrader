package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val email: String,
    val username: String = "",
    val role: UserRole = UserRole.user,
    val createdAt: Double? = null,
    val updatedAt: Double? = null,
    val lastLogin: Double? = null,
    val brokerType: BrokerType? = null,
    val hasZerodhaCredentials: Boolean? = null,
    val hasMotilalCredentials: Boolean? = null,
    val hasDhanCredentials: Boolean? = null,
    val hasAngelOneCredentials: Boolean? = null,
    val hasUpstoxCredentials: Boolean? = null,
    val plan: PlanType? = null,
    val planStatus: PlanStatus? = null,
    val trialStartedAt: String? = null,
    val trialEndsAt: String? = null,
    val liveTradingEnabled: Boolean? = null,
    val accountEnabled: Boolean? = null,
    val capitalLimit: Double? = null,
    val lastActive: Double? = null,
    val emailOptOut: Boolean? = null,
    val settings: UserSettings? = null,
)

@Serializable
enum class UserRole { user, admin }

@Serializable
enum class BrokerType { zerodha, motilal, dhan, angelone, upstox, none }

@Serializable
enum class PlanType { starter, pro, premium }

@Serializable
enum class PlanStatus { active, trial, expired, cancelled }

@Serializable
data class UserSettings(
    val soundEnabled: Boolean = true,
    val darkMode: Boolean = true,
    val requireSigmaApproval: Boolean = false,
)
