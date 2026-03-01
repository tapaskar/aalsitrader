package com.aalsitrader.android.ui.papertrading

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.*
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.PillBadge
import com.aalsitrader.android.ui.components.PnLText
import com.aalsitrader.android.ui.components.TimeAgoText
import com.aalsitrader.android.ui.theme.*

@Composable
fun TradeRow(
    trade: PaperTrade,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val signalColor = if (trade.signal == TradeSignal.BUY) ProfitGreen else LossRed
    val statusColor = when (trade.status) {
        TradeStatus.open -> StatusActive
        TradeStatus.closed -> TextMuted
        TradeStatus.cancelled -> StatusWarning
    }

    CardSurface(
        modifier = modifier.clickable(onClick = onClick),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = trade.symbol,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    PillBadge(text = trade.signal.name, color = signalColor)
                    Spacer(modifier = Modifier.width(4.dp))
                    PillBadge(text = trade.status.name.uppercase(), color = statusColor)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Entry: \u20B9${String.format("%.2f", trade.entryPrice)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                )
                trade.exitPrice?.let {
                    Text(
                        text = "Exit: \u20B9${String.format("%.2f", it)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                trade.netPnL?.let { PnLText(value = it, style = MaterialTheme.typography.titleSmall) }
                trade.pnlPercent?.let {
                    Text(
                        text = "${if (it >= 0) "+" else ""}${String.format("%.2f", it)}%",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (it >= 0) ProfitGreen else LossRed,
                    )
                }
                TimeAgoText(timestamp = trade.entryTime)
            }
        }
    }
}
