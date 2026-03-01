package com.aalsitrader.android.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import com.aalsitrader.android.ui.theme.LossRed
import com.aalsitrader.android.ui.theme.ProfitGreen
import com.aalsitrader.android.ui.theme.TextSecondary
import com.aalsitrader.android.util.inrFormatted

@Composable
fun PnLText(
    value: Double,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.titleMedium,
    showSign: Boolean = true,
) {
    val color = when {
        value > 0 -> ProfitGreen
        value < 0 -> LossRed
        else -> TextSecondary
    }
    val prefix = when {
        showSign && value > 0 -> "+"
        else -> ""
    }
    Text(
        text = "$prefix${value.inrFormatted()}",
        color = color,
        style = style,
        fontWeight = FontWeight.SemiBold,
        modifier = modifier,
    )
}
