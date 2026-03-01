package com.aalsitrader.android.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.CommMessage
import com.aalsitrader.android.ui.components.EmptyState

@Composable
fun CommPanel(
    comms: List<CommMessage>,
    modifier: Modifier = Modifier,
) {
    if (comms.isEmpty()) {
        EmptyState(title = "No communications", subtitle = "Agent discussions will appear here")
        return
    }

    LazyColumn(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(max = 400.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(comms.take(30), key = { it.id }) { comm ->
            CommBubble(comm = comm)
        }
    }
}
