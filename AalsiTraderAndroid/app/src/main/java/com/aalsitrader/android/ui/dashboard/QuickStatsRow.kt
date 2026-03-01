package com.aalsitrader.android.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.Activity
import com.aalsitrader.android.model.Agent
import com.aalsitrader.android.model.AgentStatus
import com.aalsitrader.android.ui.components.StatCard
import com.aalsitrader.android.ui.theme.StatusActive

@Composable
fun QuickStatsRow(
    activities: List<Activity>,
    agents: List<Agent>,
    modifier: Modifier = Modifier,
) {
    val activeAgents = agents.count { it.status == AgentStatus.active }

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        StatCard(
            label = "Active Agents",
            value = "$activeAgents/${agents.size}",
            valueColor = StatusActive,
            modifier = Modifier.weight(1f),
        )
        StatCard(
            label = "Activities",
            value = "${activities.size}",
            modifier = Modifier.weight(1f),
        )
        StatCard(
            label = "Alerts",
            value = "${activities.count { it.type == com.aalsitrader.android.model.ActivityType.alert }}",
            modifier = Modifier.weight(1f),
        )
    }
}
