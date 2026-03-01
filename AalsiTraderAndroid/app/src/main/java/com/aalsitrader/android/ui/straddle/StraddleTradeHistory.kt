package com.aalsitrader.android.ui.straddle

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.StraddleTrade
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.EmptyState
import com.aalsitrader.android.ui.components.PillBadge
import com.aalsitrader.android.ui.components.PnLText
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.util.inrFormatted

@Composable
fun StraddleTradeHistory(
    trades: List<StraddleTrade>,
    modifier: Modifier = Modifier,
) {
    Text(
        text = "Trade History",
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.SemiBold,
        color = TextPrimary,
    )
    Spacer(modifier = Modifier.height(8.dp))

    if (trades.isEmpty()) {
        EmptyState(title = "No trades yet")
        return
    }

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        trades.forEach { trade ->
            CardSurface {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = trade.tradeDate,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary,
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            PillBadge(
                                text = trade.mode.name.uppercase(),
                                color = if (trade.mode == com.aalsitrader.android.model.TradingMode.live) SigmaGreen else StatusWarning,
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = trade.strategyType.replace("_", " "),
                            style = MaterialTheme.typography.bodySmall,
                            color = TextMuted,
                        )
                        Text(
                            text = "Exit: ${trade.exitReason}",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextMuted,
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        PnLText(value = trade.netPnl, style = MaterialTheme.typography.titleSmall)
                        Text(
                            text = "${trade.entryTime} - ${trade.exitTime}",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextMuted,
                        )
                    }
                }
            }
        }
    }
}
