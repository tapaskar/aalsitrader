package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class SmartMoneyStock(
    val symbol: String,
    val price: Double = 0.0,
    val trendStrength: Double = 0.0,
    val confidence: Double = 0.0,
    val structure: MarketStructure = MarketStructure.RANGE,
    val signal: StockSignal = StockSignal.NEUTRAL,
    val rsi: Double = 0.0,
    val momentum5d: Double? = null,
    val trend: String? = null,
    val volumeSurge: Boolean? = null,
    val support: Double? = null,
    val resistance: Double? = null,
    val sma20: Double? = null,
    val sma50: Double? = null,
)

@Serializable
enum class MarketStructure {
    BOS_BULLISH, BOS_BEARISH, CHOCH_BULLISH, CHOCH_BEARISH, RANGE
}

@Serializable
enum class StockSignal { BUY, SELL, NEUTRAL }

@Serializable
data class CandleData(
    val date: String = "",
    val timestamp: Double? = null,
    val open: Double = 0.0,
    val high: Double = 0.0,
    val low: Double = 0.0,
    val close: Double = 0.0,
    val volume: Double? = null,
)
