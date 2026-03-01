package com.aalsitrader.android.ui.screener

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.SmartMoneyStock
import com.aalsitrader.android.model.StockSignal
import com.aalsitrader.android.ui.components.StatCard
import com.aalsitrader.android.ui.theme.LossRed
import com.aalsitrader.android.ui.theme.ProfitGreen
import com.aalsitrader.android.ui.theme.StatusWarning

@Composable
fun ScreenerSummaryCards(
    stocks: List<SmartMoneyStock>,
    modifier: Modifier = Modifier,
) {
    val buyCount = stocks.count { it.signal == StockSignal.BUY }
    val sellCount = stocks.count { it.signal == StockSignal.SELL }
    val neutralCount = stocks.count { it.signal == StockSignal.NEUTRAL }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        StatCard(label = "BUY", value = "$buyCount", valueColor = ProfitGreen, modifier = Modifier.weight(1f))
        StatCard(label = "SELL", value = "$sellCount", valueColor = LossRed, modifier = Modifier.weight(1f))
        StatCard(label = "NEUTRAL", value = "$neutralCount", valueColor = StatusWarning, modifier = Modifier.weight(1f))
    }
}
