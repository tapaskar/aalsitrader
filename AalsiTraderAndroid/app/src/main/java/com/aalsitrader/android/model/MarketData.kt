package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class MarketIndex(
    val value: Double = 0.0,
    val change: Double = 0.0,
    val changePercent: Double = 0.0,
)

@Serializable
data class MarketIndices(
    val nifty: MarketIndex? = null,
    val bankNifty: MarketIndex? = null,
    val sensex: MarketIndex? = null,
)

@Serializable
data class MarketDataResponse(
    val indices: MarketIndices? = null,
    val fetchedAt: Long? = null,
    val marketOpen: Boolean? = null,
) {
    /** Convert the map-based response into a named list for UI display */
    fun toIndexList(): List<NamedMarketIndex> {
        val idx = indices ?: return emptyList()
        return buildList {
            idx.nifty?.let { add(NamedMarketIndex("NIFTY", it)) }
            idx.bankNifty?.let { add(NamedMarketIndex("BANK NIFTY", it)) }
            idx.sensex?.let { add(NamedMarketIndex("SENSEX", it)) }
        }
    }
}

data class NamedMarketIndex(
    val name: String,
    val index: MarketIndex,
)
