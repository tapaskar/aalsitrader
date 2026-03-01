package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class Trade(
    val id: String,
    val symbol: String = "",
    val direction: TradeDirection = TradeDirection.long,
    val entryPrice: Double = 0.0,
    val exitPrice: Double? = null,
    val stopLoss: Double = 0.0,
    val target: Double = 0.0,
    val status: TradeStatus = TradeStatus.open,
    val pnl: Double? = null,
    val pnlPercent: Double? = null,
    val setupType: String? = null,
    val grade: TradeGrade? = null,
    val entryTime: ActivityTimestamp = ActivityTimestamp.Epoch(0.0),
    val exitTime: ActivityTimestamp? = null,
    val agentId: String? = null,
    val notes: String? = null,
)

@Serializable
enum class TradeDirection { long, short }

@Serializable
enum class TradeStatus { open, closed, cancelled }

@Serializable
enum class TradeGrade { A, B, C, D, F }
