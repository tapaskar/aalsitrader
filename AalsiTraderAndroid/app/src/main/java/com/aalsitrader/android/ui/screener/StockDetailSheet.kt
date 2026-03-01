package com.aalsitrader.android.ui.screener

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.CandleData
import com.aalsitrader.android.model.SmartMoneyStock
import com.aalsitrader.android.model.StockSignal
import com.aalsitrader.android.ui.components.PillBadge
import com.aalsitrader.android.ui.papertrading.DetailRow
import com.aalsitrader.android.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StockDetailSheet(
    stock: SmartMoneyStock,
    chartData: List<CandleData>,
    onDismiss: () -> Unit,
) {
    val signalColor = when (stock.signal) {
        StockSignal.BUY -> ProfitGreen
        StockSignal.SELL -> LossRed
        StockSignal.NEUTRAL -> StatusWarning
    }

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
                    text = stock.symbol,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                )
                Spacer(modifier = Modifier.width(8.dp))
                PillBadge(text = stock.signal.name, color = signalColor)
            }

            Text(
                text = "\u20B9${String.format("%.2f", stock.price)}",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
            )

            // Chart
            if (chartData.isNotEmpty()) {
                CandlestickChart(
                    candles = chartData,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                )
            }

            Divider(color = AppBorder.copy(alpha = 0.3f))

            // Details
            DetailRow("Signal", stock.signal.name)
            DetailRow("Structure", stock.structure.name.replace("_", " "))
            DetailRow("Confidence", "${String.format("%.0f", stock.confidence)}%")
            DetailRow("Trend Strength", "${String.format("%.0f", stock.trendStrength)}%")
            DetailRow("RSI", String.format("%.2f", stock.rsi))
            stock.trend?.let { DetailRow("Trend", it) }
            stock.support?.let { DetailRow("Support", "\u20B9${String.format("%.2f", it)}") }
            stock.resistance?.let { DetailRow("Resistance", "\u20B9${String.format("%.2f", it)}") }
            stock.sma20?.let { DetailRow("SMA 20", "\u20B9${String.format("%.2f", it)}") }
            stock.sma50?.let { DetailRow("SMA 50", "\u20B9${String.format("%.2f", it)}") }
            stock.volumeSurge?.let { DetailRow("Volume Surge", if (it) "Yes" else "No") }
        }
    }
}
