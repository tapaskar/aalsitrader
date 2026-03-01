package com.aalsitrader.android.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aalsitrader.android.model.NamedMarketIndex
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.MarketDataViewModel

@Composable
fun MarketDataBar(
    modifier: Modifier = Modifier,
    marketDataViewModel: MarketDataViewModel = viewModel(),
) {
    val indices by marketDataViewModel.indices.collectAsState()

    if (indices.isEmpty()) return

    LazyRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
    ) {
        items(indices) { item ->
            MarketIndexChip(item)
        }
    }
}

@Composable
private fun MarketIndexChip(item: NamedMarketIndex) {
    val idx = item.index
    val changeColor = if (idx.change >= 0) ProfitGreen else LossRed
    val sign = if (idx.change >= 0) "+" else ""

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text = item.name,
            style = MaterialTheme.typography.labelSmall,
            color = TextMuted,
        )
        Text(
            text = String.format("%.0f", idx.value),
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = TextPrimary,
        )
        Text(
            text = "$sign${String.format("%.1f", idx.change)} (${sign}${String.format("%.2f", idx.changePercent)}%)",
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
            color = changeColor,
        )
    }
}
