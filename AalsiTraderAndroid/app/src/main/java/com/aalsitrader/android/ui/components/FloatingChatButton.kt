package com.aalsitrader.android.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.ui.theme.AccentCyan
import com.aalsitrader.android.ui.theme.AppBackground

@Composable
fun FloatingChatButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    FloatingActionButton(
        onClick = onClick,
        modifier = modifier.size(56.dp),
        shape = CircleShape,
        containerColor = AccentCyan,
        contentColor = AppBackground,
    ) {
        Icon(
            imageVector = Icons.Default.Chat,
            contentDescription = "Chat with Prime",
        )
    }
}
