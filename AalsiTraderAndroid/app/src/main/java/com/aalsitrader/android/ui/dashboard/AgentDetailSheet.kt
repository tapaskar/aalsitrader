package com.aalsitrader.android.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.Activity
import com.aalsitrader.android.model.Agent
import com.aalsitrader.android.model.AgentStatus
import com.aalsitrader.android.ui.components.AgentAvatar
import com.aalsitrader.android.ui.components.PillBadge
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.util.AgentDefinitions

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AgentDetailSheet(
    agent: Agent,
    activities: List<Activity>,
    onDismiss: () -> Unit,
) {
    val agentColor = AgentDefinitions.colorForAgent(agent.id)

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
        ) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                AgentAvatar(greek = agent.greek, color = agentColor, size = 48.dp)
                Spacer(modifier = Modifier.width(16.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = agent.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                    )
                    Text(
                        text = agent.role,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                    )
                }
                PillBadge(
                    text = agent.status.name.uppercase(),
                    color = when (agent.status) {
                        AgentStatus.active -> StatusActive
                        AgentStatus.sleeping -> StatusSleeping
                        AgentStatus.error -> StatusDanger
                    },
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Stats
            agent.stats?.let { stats ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    stats.tasksCompleted?.let {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("$it", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = agentColor)
                            Text("Tasks", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        }
                    }
                    stats.alertsSent?.let {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("$it", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = agentColor)
                            Text("Alerts", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        }
                    }
                    stats.accuracy?.let {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("${String.format("%.0f", it)}%", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = agentColor)
                            Text("Accuracy", style = MaterialTheme.typography.labelSmall, color = TextMuted)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Current Task
            agent.currentTask?.let { task ->
                Text("Current Task", style = MaterialTheme.typography.labelMedium, color = TextMuted)
                Spacer(modifier = Modifier.height(4.dp))
                Text(task, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Recent Activity
            if (activities.isNotEmpty()) {
                Text(
                    "Recent Activity",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary,
                )
                Spacer(modifier = Modifier.height(8.dp))
                LazyColumn(
                    modifier = Modifier.heightIn(max = 300.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    items(activities.take(10)) { activity ->
                        ActivityRow(activity = activity)
                    }
                }
            }
        }
    }
}
