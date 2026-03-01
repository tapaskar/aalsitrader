package com.aalsitrader.android.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.Activity
import com.aalsitrader.android.model.ActivityType
import com.aalsitrader.android.ui.components.AgentAvatar
import com.aalsitrader.android.ui.components.TimeAgoText
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.util.AgentDefinitions

@Composable
fun ActivityRow(
    activity: Activity,
    modifier: Modifier = Modifier,
) {
    val agentColor = AgentDefinitions.colorForHex(activity.agentColor)
    val typeColor = when (activity.type) {
        ActivityType.info -> AccentCyan
        ActivityType.alert -> StatusWarning
        ActivityType.success -> ProfitGreen
        ActivityType.warning -> StatusWarning
        ActivityType.error -> LossRed
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.Top,
    ) {
        AgentAvatar(greek = activity.agentGreek, color = agentColor, size = 32.dp)
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = activity.agentName,
                    style = MaterialTheme.typography.labelMedium,
                    color = agentColor,
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = activity.type.name.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = typeColor,
                )
            }
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = activity.content,
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(modifier = Modifier.width(8.dp))
        TimeAgoText(timestamp = activity.timestamp)
    }
}
