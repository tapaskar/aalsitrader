package com.aalsitrader.android.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.aalsitrader.android.model.TradingMode
import com.aalsitrader.android.ui.theme.StatusWarning
import com.aalsitrader.android.ui.theme.SigmaGreen

@Composable
fun ModeIndicator(
    mode: TradingMode,
    modifier: Modifier = Modifier,
) {
    val (text, color) = when (mode) {
        TradingMode.paper -> "PAPER" to StatusWarning
        TradingMode.live -> "LIVE" to SigmaGreen
    }
    PillBadge(text = text, color = color, modifier = modifier)
}
