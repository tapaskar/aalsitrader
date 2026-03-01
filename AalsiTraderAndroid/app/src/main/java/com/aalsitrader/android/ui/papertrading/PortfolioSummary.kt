package com.aalsitrader.android.ui.papertrading

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.PaperPortfolio
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.PnLText
import com.aalsitrader.android.ui.components.StatCard
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.util.inrFormatted
import com.aalsitrader.android.util.pctFormatted

@Composable
fun PortfolioSummary(
    portfolio: PaperPortfolio,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Capital Card
        CardSurface {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Total Capital", style = MaterialTheme.typography.labelMedium, color = TextMuted)
                PnLText(value = portfolio.capital, style = MaterialTheme.typography.headlineMedium, showSign = false)
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text("Day P&L", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        PnLText(value = portfolio.dayPnl, style = MaterialTheme.typography.bodyMedium)
                    }
                    Column {
                        Text("Total P&L", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        PnLText(value = portfolio.totalPnl, style = MaterialTheme.typography.bodyMedium)
                    }
                    Column {
                        Text("Unrealized", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        PnLText(value = portfolio.unrealizedPnl, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }

        // Stats Grid
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatCard(
                label = "Win Rate",
                value = portfolio.winRate.pctFormatted(),
                valueColor = if (portfolio.winRate >= 50) ProfitGreen else LossRed,
                modifier = Modifier.weight(1f),
            )
            StatCard(
                label = "Open Positions",
                value = "${portfolio.openPositions}",
                modifier = Modifier.weight(1f),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatCard(
                label = "Max Drawdown",
                value = portfolio.maxDrawdown.pctFormatted(),
                valueColor = LossRed,
                modifier = Modifier.weight(1f),
            )
            StatCard(
                label = "Margin Used",
                value = portfolio.marginUsed.inrFormatted(),
                modifier = Modifier.weight(1f),
            )
        }
    }
}
