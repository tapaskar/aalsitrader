package com.aalsitrader.android.ui.papertrading

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.PaperTrade
import com.aalsitrader.android.ui.components.EmptyState

@Composable
fun TradeHistory(
    trades: List<PaperTrade>,
    modifier: Modifier = Modifier,
) {
    var selectedTrade by remember { mutableStateOf<PaperTrade?>(null) }

    if (trades.isEmpty()) {
        EmptyState(title = "No trades yet", subtitle = "Trades will appear here when executed")
        return
    }

    LazyColumn(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(max = 600.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(trades, key = { it.id }) { trade ->
            TradeRow(
                trade = trade,
                onClick = { selectedTrade = trade },
            )
        }
    }

    selectedTrade?.let { trade ->
        TradeDetailSheet(
            trade = trade,
            onDismiss = { selectedTrade = null },
        )
    }
}
