package com.aalsitrader.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = AccentCyan,
    onPrimary = AppBackground,
    secondary = SigmaGreen,
    onSecondary = AppBackground,
    tertiary = GammaPurple,
    background = AppBackground,
    onBackground = TextPrimary,
    surface = CardBackground,
    onSurface = TextPrimary,
    surfaceVariant = CardHover,
    onSurfaceVariant = TextSecondary,
    outline = AppBorder,
    error = StatusDanger,
    onError = TextPrimary,
)

@Composable
fun AalsiTraderTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = AalsiTraderTypography,
        content = content
    )
}
