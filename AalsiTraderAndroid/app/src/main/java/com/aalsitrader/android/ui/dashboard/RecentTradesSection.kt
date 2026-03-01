package com.aalsitrader.android.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.Activity
import com.aalsitrader.android.model.ActivityType
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.EmptyState
import com.aalsitrader.android.ui.components.TimeAgoText
import com.aalsitrader.android.ui.theme.*

@Composable
fun RecentTradesSection(
    activities: List<Activity>,
    modifier: Modifier = Modifier,
) {
    val tradeActivities = activities.filter {
        it.content.contains("trade", ignoreCase = true) ||
                it.content.contains("signal", ignoreCase = true) ||
                it.content.contains("entry", ignoreCase = true) ||
                it.content.contains("exit", ignoreCase = true)
    }.take(5)

    Text(
        text = "Recent Trade Signals",
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        color = TextPrimary,
    )
    Spacer(modifier = Modifier.height(8.dp))

    if (tradeActivities.isEmpty()) {
        EmptyState(title = "No recent trade signals")
        return
    }

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        tradeActivities.forEach { activity ->
            CardSurface {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = activity.agentName,
                            style = MaterialTheme.typography.labelMedium,
                            color = com.aalsitrader.android.util.AgentDefinitions.colorForHex(activity.agentColor),
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = activity.content,
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondary,
                            maxLines = 2,
                        )
                    }
                    TimeAgoText(timestamp = activity.timestamp)
                }
            }
        }
    }
}
