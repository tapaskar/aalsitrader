package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class SigmaApproval(
    val tradeId: String,
    val symbol: String = "",
    val signal: TradeSignal = TradeSignal.BUY,
    val entryPrice: Double = 0.0,
    val timestamp: ActivityTimestamp = ActivityTimestamp.Epoch(0.0),
    val status: ApprovalStatus = ApprovalStatus.pending,
    val sigmaApprovedBy: String? = null,
    val sigmaApprovedAt: ActivityTimestamp? = null,
    val indicators: PaperTradeIndicators? = null,
    val requiresApproval: Boolean? = null,
)

@Serializable
enum class ApprovalStatus { pending, approved, rejected }
