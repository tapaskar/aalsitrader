package com.aalsitrader.android.ui.straddle

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.EngineStatus
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.PillBadge
import com.aalsitrader.android.ui.theme.*

@Composable
fun EngineStatusCard(
    status: EngineStatus,
    modifier: Modifier = Modifier,
) {
    CardSurface(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "Engine Status",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = TextPrimary,
            )

            // Status pills
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                PillBadge(
                    text = if (status.engine.running) "RUNNING" else "STOPPED",
                    color = if (status.engine.running) StatusActive else StatusSleeping,
                )
                PillBadge(
                    text = if (status.market.isOpen) "MARKET OPEN" else "MARKET CLOSED",
                    color = if (status.market.isOpen) ProfitGreen else StatusWarning,
                )
                PillBadge(
                    text = if (status.broker.connected) "CONNECTED" else "DISCONNECTED",
                    color = if (status.broker.connected) ProfitGreen else LossRed,
                )
            }

            // Details
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column {
                    Text("Mode", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Text(
                        text = (status.engine.mode?.name ?: "N/A").uppercase(),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = TextPrimary,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Index", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                    Text(
                        text = status.engine.indexName?.name ?: "N/A",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = TextPrimary,
                    )
                }
            }

            status.engine.lastSpot?.let { spot ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text("Last Spot", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        Text(
                            text = String.format("%.2f", spot),
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextPrimary,
                        )
                    }
                    status.engine.strategyType?.let { st ->
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Strategy", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                            Text(
                                text = st.displayName,
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextPrimary,
                            )
                        }
                    }
                }
            }
        }
    }
}
