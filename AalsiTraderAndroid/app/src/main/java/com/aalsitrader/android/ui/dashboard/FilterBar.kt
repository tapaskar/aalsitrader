package com.aalsitrader.android.ui.dashboard

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.Agent
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.util.AgentDefinitions

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilterBar(
    agents: List<Agent>,
    selectedFilter: String?,
    onFilterSelected: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FilterChip(
            selected = selectedFilter == null,
            onClick = { onFilterSelected(null) },
            label = { Text("All") },
            colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = AccentCyan.copy(alpha = 0.2f),
                selectedLabelColor = AccentCyan,
                containerColor = CardBackground,
                labelColor = TextSecondary,
            ),
        )
        agents.forEach { agent ->
            val agentColor = AgentDefinitions.colorForAgent(agent.id)
            FilterChip(
                selected = selectedFilter == agent.id,
                onClick = { onFilterSelected(agent.id) },
                label = { Text(agent.greek) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = agentColor.copy(alpha = 0.2f),
                    selectedLabelColor = agentColor,
                    containerColor = CardBackground,
                    labelColor = TextSecondary,
                ),
            )
        }
    }
}
