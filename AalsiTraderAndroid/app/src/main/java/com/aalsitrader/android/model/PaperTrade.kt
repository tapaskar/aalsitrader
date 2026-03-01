package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class PaperTrade(
    val id: String,
    val symbol: String = "",
    val signal: TradeSignal = TradeSignal.BUY,
    val status: TradeStatus = TradeStatus.open,
    val entryTime: ActivityTimestamp = ActivityTimestamp.Epoch(0.0),
    val exitTime: ActivityTimestamp? = null,
    val entryPrice: Double = 0.0,
    val exitPrice: Double? = null,
    val exitReason: ExitReason? = null,
    val futuresLots: Int? = null,
    val optionLots: Int? = null,
    val lotSize: Int? = null,
    val atmStrike: Double? = null,
    val optionType: OptionType? = null,
    val optionEntryPrice: Double? = null,
    val optionExitPrice: Double? = null,
    val optionExpiry: String? = null,
    val marginUsed: Double? = null,
    val hedgeCost: Double? = null,
    val initialRisk: Double? = null,
    val maxLoss: Double? = null,
    val grossPnL: Double? = null,
    val hedgePnL: Double? = null,
    val netPnL: Double? = null,
    val pnlPercent: Double? = null,
    val brokerage: Double? = null,
    val stt: Double? = null,
    val transactionCharges: Double? = null,
    val gst: Double? = null,
    val totalCharges: Double? = null,
    val indicators: PaperTradeIndicators? = null,
    val duration: String? = null,
)

@Serializable
enum class TradeSignal { BUY, SELL }

@Serializable
enum class ExitReason { target, stoploss, momentum_exhaustion, reversal, manual, expiry }

@Serializable
enum class OptionType { CE, PE }

@Serializable
data class PaperTradeIndicators(
    val rsi: Double? = null,
    val macd: Double? = null,
    val trend: String? = null,
    val signal: String? = null,
    val confidence: Double? = null,
)
