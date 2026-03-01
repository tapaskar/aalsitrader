package com.aalsitrader.android.ui.straddle

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.StraddleCapital
import com.aalsitrader.android.ui.components.StatCard
import com.aalsitrader.android.ui.theme.LossRed
import com.aalsitrader.android.ui.theme.ProfitGreen
import com.aalsitrader.android.util.inrShort
import com.aalsitrader.android.util.pctFormatted

@Composable
fun CapitalSummary(
    capital: StraddleCapital,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatCard(
                label = "Capital",
                value = capital.currentCapital.inrShort(),
                modifier = Modifier.weight(1f),
            )
            StatCard(
                label = "Total P&L",
                value = capital.totalPnl.inrShort(),
                valueColor = if (capital.totalPnl >= 0) ProfitGreen else LossRed,
                modifier = Modifier.weight(1f),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatCard(
                label = "Win Rate",
                value = capital.winRate.pctFormatted(),
                valueColor = if (capital.winRate >= 50) ProfitGreen else LossRed,
                modifier = Modifier.weight(1f),
            )
            StatCard(
                label = "Trades",
                value = "${capital.totalTrades}",
                modifier = Modifier.weight(1f),
            )
        }
    }
}
