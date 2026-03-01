package com.aalsitrader.android.ui.screener

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.StockSignal
import com.aalsitrader.android.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScreenerFilterBar(
    signalFilter: StockSignal?,
    onSignalFilterChange: (StockSignal?) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FilterChip(
            selected = signalFilter == null,
            onClick = { onSignalFilterChange(null) },
            label = { Text("All") },
            colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = AccentCyan.copy(alpha = 0.2f),
                selectedLabelColor = AccentCyan,
                containerColor = CardBackground,
                labelColor = TextSecondary,
            ),
        )
        FilterChip(
            selected = signalFilter == StockSignal.BUY,
            onClick = { onSignalFilterChange(StockSignal.BUY) },
            label = { Text("BUY") },
            colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = ProfitGreen.copy(alpha = 0.2f),
                selectedLabelColor = ProfitGreen,
                containerColor = CardBackground,
                labelColor = TextSecondary,
            ),
        )
        FilterChip(
            selected = signalFilter == StockSignal.SELL,
            onClick = { onSignalFilterChange(StockSignal.SELL) },
            label = { Text("SELL") },
            colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = LossRed.copy(alpha = 0.2f),
                selectedLabelColor = LossRed,
                containerColor = CardBackground,
                labelColor = TextSecondary,
            ),
        )
        FilterChip(
            selected = signalFilter == StockSignal.NEUTRAL,
            onClick = { onSignalFilterChange(StockSignal.NEUTRAL) },
            label = { Text("NEUTRAL") },
            colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = StatusWarning.copy(alpha = 0.2f),
                selectedLabelColor = StatusWarning,
                containerColor = CardBackground,
                labelColor = TextSecondary,
            ),
        )
    }
}
