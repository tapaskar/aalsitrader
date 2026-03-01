package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class BrokerPortfolio(
    val positions: List<BrokerPosition>? = null,
    val holdings: List<BrokerHolding>? = null,
    val funds: BrokerFunds? = null,
    val broker: String? = null,
    val needsBrokerSetup: Boolean? = null,
    val error: String? = null,
)

@Serializable
data class BrokerPosition(
    val tradingsymbol: String? = null,
    val tradingSymbol: String? = null,
    val exchange: String? = null,
    val exchangeSegment: String? = null,
    val quantity: Int? = null,
    val netQty: Int? = null,
    val average_price: Double? = null,
    val buyAvg: Double? = null,
    val last_price: Double? = null,
    val lastPrice: Double? = null,
    val pnl: Double? = null,
    val dayPnl: Double? = null,
    val product: String? = null,
    val productType: String? = null,
) {
    val displaySymbol: String get() = tradingsymbol ?: tradingSymbol ?: ""
    val displayQty: Int get() = quantity ?: netQty ?: 0
    val displayAvgPrice: Double get() = average_price ?: buyAvg ?: 0.0
    val displayLastPrice: Double get() = last_price ?: lastPrice ?: 0.0
    val displayPnl: Double get() = pnl ?: dayPnl ?: 0.0
}

@Serializable
data class BrokerHolding(
    val tradingsymbol: String? = null,
    val tradingSymbol: String? = null,
    val quantity: Int? = null,
    val average_price: Double? = null,
    val last_price: Double? = null,
    val pnl: Double? = null,
) {
    val displaySymbol: String get() = tradingsymbol ?: tradingSymbol ?: ""
}

@Serializable
data class BrokerFunds(
    val availableBalance: Double? = null,
    val usedMargin: Double? = null,
    val totalBalance: Double? = null,
    val dayPnl: Double? = null,
)
