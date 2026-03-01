package com.aalsitrader.android.ui.papertrading

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.PaperMetrics
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.StatCard
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.util.inrFormatted
import com.aalsitrader.android.util.pctFormatted

@Composable
fun PerformanceMetrics(
    metrics: PaperMetrics,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Summary
        CardSurface {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Performance Summary", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                Spacer(modifier = Modifier.height(12.dp))
                DetailRow("Total Trades", "${metrics.totalTrades}")
                DetailRow("Winning", "${metrics.winningTrades}")
                DetailRow("Losing", "${metrics.losingTrades}")
                DetailRow("Win Rate", metrics.winRate.pctFormatted())
                DetailRow("Net P&L", metrics.netPnL.inrFormatted())
                DetailRow("Total Return", metrics.totalReturn.pctFormatted())
            }
        }

        // Risk Metrics
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatCard(label = "Sharpe", value = String.format("%.2f", metrics.sharpeRatio), modifier = Modifier.weight(1f))
            StatCard(label = "Sortino", value = String.format("%.2f", metrics.sortinoRatio), modifier = Modifier.weight(1f))
            StatCard(label = "Calmar", value = String.format("%.2f", metrics.calmarRatio), modifier = Modifier.weight(1f))
        }

        CardSurface {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Detailed Metrics", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                Spacer(modifier = Modifier.height(12.dp))
                DetailRow("Profit Factor", String.format("%.2f", metrics.profitFactor))
                DetailRow("Max Drawdown", metrics.maxDrawdown.pctFormatted())
                DetailRow("Avg Win", metrics.avgWin.inrFormatted())
                DetailRow("Avg Loss", metrics.avgLoss.inrFormatted())
                DetailRow("Largest Win", metrics.largestWin.inrFormatted())
                DetailRow("Largest Loss", metrics.largestLoss.inrFormatted())
                metrics.avgTradeDuration?.let { DetailRow("Avg Duration", it) }
                metrics.bestPerformingSymbol?.let { DetailRow("Best Symbol", it) }
                metrics.worstPerformingSymbol?.let { DetailRow("Worst Symbol", it) }
            }
        }

        // Recommendations
        metrics.recommendations?.let { recs ->
            if (recs.isNotEmpty()) {
                CardSurface {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Recommendations", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = AccentCyan)
                        Spacer(modifier = Modifier.height(8.dp))
                        recs.forEach { rec ->
                            Text(
                                text = "• $rec",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary,
                                modifier = Modifier.padding(vertical = 2.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}
