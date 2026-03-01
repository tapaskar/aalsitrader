package com.aalsitrader.android.ui.papertrading

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.PaperTrade
import com.aalsitrader.android.ui.components.PillBadge
import com.aalsitrader.android.ui.components.PnLText
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.util.inrFormatted
import com.aalsitrader.android.util.toIstDateTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TradeDetailSheet(
    trade: PaperTrade,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = CardBackground,
        contentColor = TextPrimary,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Header
            Row {
                Text(
                    text = trade.symbol,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                )
                Spacer(modifier = Modifier.width(8.dp))
                PillBadge(
                    text = trade.signal.name,
                    color = if (trade.signal == com.aalsitrader.android.model.TradeSignal.BUY) ProfitGreen else LossRed,
                )
            }

            // P&L
            trade.netPnL?.let {
                Text("Net P&L", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                PnLText(value = it, style = MaterialTheme.typography.headlineMedium)
            }

            Divider(color = AppBorder.copy(alpha = 0.3f))

            // Details
            DetailRow("Entry Price", "\u20B9${String.format("%.2f", trade.entryPrice)}")
            trade.exitPrice?.let { DetailRow("Exit Price", "\u20B9${String.format("%.2f", it)}") }
            trade.exitReason?.let { DetailRow("Exit Reason", it.name.replace("_", " ")) }
            trade.duration?.let { DetailRow("Duration", it) }
            DetailRow("Entry Time", trade.entryTime.toIstDateTime())
            trade.exitTime?.let { DetailRow("Exit Time", it.toIstDateTime()) }

            Divider(color = AppBorder.copy(alpha = 0.3f))

            // Costs
            trade.marginUsed?.let { DetailRow("Margin Used", it.inrFormatted()) }
            trade.totalCharges?.let { DetailRow("Total Charges", it.inrFormatted()) }

            // Indicators
            trade.indicators?.let { ind ->
                Divider(color = AppBorder.copy(alpha = 0.3f))
                Text("Indicators", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                ind.rsi?.let { DetailRow("RSI", String.format("%.2f", it)) }
                ind.macd?.let { DetailRow("MACD", String.format("%.4f", it)) }
                ind.trend?.let { DetailRow("Trend", it) }
                ind.confidence?.let { DetailRow("Confidence", "${String.format("%.0f", it * 100)}%") }
            }
        }
    }
}

@Composable
internal fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = TextMuted)
        Text(text = value, style = MaterialTheme.typography.bodySmall, color = TextPrimary, fontWeight = FontWeight.Medium)
    }
}
