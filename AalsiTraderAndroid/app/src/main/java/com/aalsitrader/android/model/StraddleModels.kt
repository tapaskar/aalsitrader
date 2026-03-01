package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class EngineStatus(
    val broker: BrokerStatusInfo = BrokerStatusInfo(),
    val market: MarketStatusInfo = MarketStatusInfo(),
    val engine: EngineState = EngineState(),
)

@Serializable
data class BrokerStatusInfo(
    val connected: Boolean = false,
    val error: String? = null,
    val name: String? = null,
    val label: String? = null,
)

@Serializable
data class MarketStatusInfo(
    val isOpen: Boolean = false,
    val istTime: String? = null,
)

@Serializable
data class EngineState(
    val running: Boolean = false,
    val mode: TradingMode? = null,
    val broker: String? = null,
    val indexName: IndexName? = null,
    val strategyType: StrategyType? = null,
    val lastSpot: Double? = null,
    val lastNiftySpot: Double? = null,
    val lastUpdate: String? = null,
)

@Serializable
enum class TradingMode { paper, live }

@Serializable
enum class IndexName { NIFTY, BANKNIFTY }

@Serializable
enum class StrategyType {
    short_straddle, short_strangle, iron_condor;

    val displayName: String
        get() = when (this) {
            short_straddle -> "Short Straddle"
            short_strangle -> "Short Strangle"
            iron_condor -> "Iron Condor"
        }
}

@Serializable
data class StraddleCapital(
    val initialCapital: Double = 0.0,
    val currentCapital: Double = 0.0,
    val totalPnl: Double = 0.0,
    val maxDrawdownPct: Double = 0.0,
    val winRate: Double = 0.0,
    val totalTrades: Int = 0,
)

@Serializable
data class StraddlePosition(
    val id: String,
    val indexName: IndexName? = null,
    val strategyType: StrategyType? = null,
    val strategyLabel: String? = null,
    val legs: List<LegDetail>? = null,
    val exitRules: ExitRules? = null,
    val ceStrike: Double = 0.0,
    val peStrike: Double = 0.0,
    val ceEntryPremium: Double = 0.0,
    val peEntryPremium: Double = 0.0,
    val ceCurPremium: Double = 0.0,
    val peCurPremium: Double = 0.0,
    val ceDelta: Double? = null,
    val peDelta: Double? = null,
    val totalCollected: Double = 0.0,
    val totalCurrent: Double = 0.0,
    val unrealizedPnl: Double = 0.0,
    val niftyEntry: Double = 0.0,
    val entryTime: String = "",
    val mode: TradingMode = TradingMode.paper,
    val broker: String? = null,
    val ceOrderId: String? = null,
    val peOrderId: String? = null,
    val marginRequired: Double? = null,
    val netMarginRequired: Double? = null,
    val capitalUtilization: Double? = null,
)

@Serializable
data class LegDetail(
    val side: String = "",
    val action: String = "",
    val strikePrice: Double = 0.0,
    val entryPremium: Double = 0.0,
    val curPremium: Double = 0.0,
    val delta: Double? = null,
    val instrumentId: String? = null,
    val orderId: String? = null,
)

@Serializable
data class ExitRules(
    val perLegSlPct: Double? = null,
    val combinedSlPct: Double = 0.0,
    val profitTargetPct: Double = 0.0,
)

@Serializable
data class StraddleTrade(
    val id: String,
    val tradeDate: String = "",
    val strategyType: String = "",
    val indexName: IndexName? = null,
    val entryTime: String = "",
    val exitTime: String = "",
    val ceEntryPremium: Double = 0.0,
    val peEntryPremium: Double = 0.0,
    val ceExitPremium: Double = 0.0,
    val peExitPremium: Double = 0.0,
    val netPnl: Double = 0.0,
    val grossPnl: Double? = null,
    val exitReason: String = "",
    val mode: TradingMode = TradingMode.paper,
    val broker: String? = null,
    val ceStrike: Double? = null,
    val peStrike: Double? = null,
    val niftyEntry: Double? = null,
    val niftyExit: Double? = null,
    val marginRequired: Double? = null,
    val netMarginRequired: Double? = null,
    val totalCollected: Double? = null,
    val totalAtExit: Double? = null,
    val lotSize: Int? = null,
    val lots: Int? = null,
    val legs: List<LegDetail>? = null,
)
