package com.aalsitrader.android.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.Agent

@Composable
fun AgentListSection(
    agents: List<Agent>,
    onAgentClick: (Agent) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(agents, key = { it.id }) { agent ->
            AgentCard(
                agent = agent,
                onClick = { onAgentClick(agent) },
            )
        }
    }
}
