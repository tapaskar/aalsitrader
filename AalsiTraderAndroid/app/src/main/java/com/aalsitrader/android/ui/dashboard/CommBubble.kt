package com.aalsitrader.android.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.CommMessage
import com.aalsitrader.android.ui.components.AgentAvatar
import com.aalsitrader.android.ui.components.TimeAgoText
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.util.AgentDefinitions

@Composable
fun CommBubble(
    comm: CommMessage,
    modifier: Modifier = Modifier,
) {
    val fromColor = AgentDefinitions.colorForHex(comm.fromColor)
    val toColor = AgentDefinitions.colorForHex(comm.toColor)

    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
    ) {
        AgentAvatar(greek = comm.fromGreek, color = fromColor, size = 32.dp)
        Spacer(modifier = Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = comm.from,
                    style = MaterialTheme.typography.labelMedium,
                    color = fromColor,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = " → ",
                    style = MaterialTheme.typography.labelSmall,
                    color = TextMuted,
                )
                Text(
                    text = comm.to,
                    style = MaterialTheme.typography.labelMedium,
                    color = toColor,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(modifier = Modifier.weight(1f))
                TimeAgoText(timestamp = comm.timestamp)
            }
            Spacer(modifier = Modifier.height(4.dp))
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = CardHover,
            ) {
                Text(
                    text = comm.content,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                    modifier = Modifier.padding(10.dp),
                )
            }
        }
    }
}
