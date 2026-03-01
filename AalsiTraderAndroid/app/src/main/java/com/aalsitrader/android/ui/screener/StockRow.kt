package com.aalsitrader.android.ui.screener

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.SmartMoneyStock
import com.aalsitrader.android.model.StockSignal
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.PillBadge
import com.aalsitrader.android.ui.theme.*

@Composable
fun StockRow(
    stock: SmartMoneyStock,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val signalColor = when (stock.signal) {
        StockSignal.BUY -> ProfitGreen
        StockSignal.SELL -> LossRed
        StockSignal.NEUTRAL -> StatusWarning
    }

    CardSurface(modifier = modifier.clickable(onClick = onClick)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = stock.symbol,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    PillBadge(text = stock.signal.name, color = signalColor)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "RSI: ${String.format("%.1f", stock.rsi)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                    )
                    Text(
                        text = "Conf: ${String.format("%.0f", stock.confidence)}%",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "\u20B9${String.format("%.2f", stock.price)}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary,
                )
                Text(
                    text = stock.structure.name.replace("_", " "),
                    style = MaterialTheme.typography.labelSmall,
                    color = TextMuted,
                )
            }
        }
    }
}
