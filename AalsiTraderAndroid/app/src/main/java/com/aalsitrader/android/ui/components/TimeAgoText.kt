package com.aalsitrader.android.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.aalsitrader.android.model.ActivityTimestamp
import com.aalsitrader.android.ui.theme.TextMuted
import com.aalsitrader.android.util.timeAgo
import kotlinx.coroutines.delay

@Composable
fun TimeAgoText(
    timestamp: ActivityTimestamp,
    modifier: Modifier = Modifier,
) {
    var text by remember { mutableStateOf(timestamp.timeAgo()) }

    LaunchedEffect(timestamp) {
        while (true) {
            text = timestamp.timeAgo()
            delay(60_000)
        }
    }

    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = TextMuted,
        modifier = modifier,
    )
}
