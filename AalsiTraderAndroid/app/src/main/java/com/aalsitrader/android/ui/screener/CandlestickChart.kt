package com.aalsitrader.android.ui.screener

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.CandleData
import com.aalsitrader.android.ui.theme.LossRed
import com.aalsitrader.android.ui.theme.ProfitGreen
import com.aalsitrader.android.ui.theme.AppBorder

@Composable
fun CandlestickChart(
    candles: List<CandleData>,
    modifier: Modifier = Modifier,
) {
    if (candles.isEmpty()) return

    val allHighs = candles.map { it.high }
    val allLows = candles.map { it.low }
    val minPrice = allLows.min()
    val maxPrice = allHighs.max()
    val priceRange = (maxPrice - minPrice).coerceAtLeast(0.01)

    Canvas(modifier = modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        val candleCount = candles.size
        val candleWidth = (w / candleCount * 0.7f).coerceAtMost(12.dp.toPx())
        val gap = w / candleCount

        candles.forEachIndexed { index, candle ->
            val x = index * gap + gap / 2
            val isGreen = candle.close >= candle.open
            val color = if (isGreen) ProfitGreen else LossRed

            val highY = h - ((candle.high - minPrice) / priceRange * h).toFloat()
            val lowY = h - ((candle.low - minPrice) / priceRange * h).toFloat()
            val openY = h - ((candle.open - minPrice) / priceRange * h).toFloat()
            val closeY = h - ((candle.close - minPrice) / priceRange * h).toFloat()

            // Wick
            drawLine(
                color = color.copy(alpha = 0.7f),
                start = Offset(x, highY),
                end = Offset(x, lowY),
                strokeWidth = 1.dp.toPx(),
            )

            // Body
            val bodyTop = minOf(openY, closeY)
            val bodyHeight = kotlin.math.abs(openY - closeY).coerceAtLeast(1f)

            drawRect(
                color = color,
                topLeft = Offset(x - candleWidth / 2, bodyTop),
                size = Size(candleWidth, bodyHeight),
            )
        }
    }
}
