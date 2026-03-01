package com.aalsitrader.android.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.ui.theme.AccentCyan
import com.aalsitrader.android.ui.theme.TextSecondary

@Composable
fun LoadingView(
    modifier: Modifier = Modifier,
    message: String = "Loading...",
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = AccentCyan)
            Spacer(modifier = Modifier.height(16.dp))
            Text(text = message, color = TextSecondary)
        }
    }
}
