package com.aalsitrader.android.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.network.ChatMessage
import com.aalsitrader.android.network.ChatRole
import com.aalsitrader.android.ui.theme.*

@Composable
fun ChatBubble(
    message: ChatMessage,
    modifier: Modifier = Modifier,
) {
    val isUser = message.role == ChatRole.user
    val alignment = if (isUser) Alignment.End else Alignment.Start
    val bgColor = if (isUser) AccentCyan.copy(alpha = 0.2f) else CardHover
    val textColor = if (isUser) AccentCyan else TextSecondary
    val shape = if (isUser) {
        RoundedCornerShape(16.dp, 16.dp, 4.dp, 16.dp)
    } else {
        RoundedCornerShape(16.dp, 16.dp, 16.dp, 4.dp)
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = alignment,
    ) {
        if (!isUser) {
            Text(
                text = "Prime \u03A3",
                style = MaterialTheme.typography.labelSmall,
                color = SigmaGreen,
                modifier = Modifier.padding(start = 4.dp, bottom = 2.dp),
            )
        }
        Surface(
            shape = shape,
            color = bgColor,
            modifier = Modifier.widthIn(max = 300.dp),
        ) {
            Text(
                text = message.content,
                style = MaterialTheme.typography.bodyMedium,
                color = textColor,
                modifier = Modifier.padding(12.dp),
            )
        }
    }
}
