package com.aalsitrader.android.ui.dashboard

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.Agent
import com.aalsitrader.android.model.AgentStatus
import com.aalsitrader.android.ui.components.AgentAvatar
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.PillBadge
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.util.AgentDefinitions

@Composable
fun AgentCard(
    agent: Agent,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val agentColor = AgentDefinitions.colorForAgent(agent.id)
    val statusColor = when (agent.status) {
        AgentStatus.active -> StatusActive
        AgentStatus.sleeping -> StatusSleeping
        AgentStatus.error -> StatusDanger
    }

    CardSurface(
        modifier = modifier
            .width(140.dp)
            .clickable(onClick = onClick),
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            AgentAvatar(greek = agent.greek, color = agentColor, size = 40.dp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = agent.name,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = agent.role,
                style = MaterialTheme.typography.labelSmall,
                color = TextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(modifier = Modifier.height(6.dp))
            PillBadge(
                text = agent.status.name.uppercase(),
                color = statusColor,
            )
        }
    }
}
