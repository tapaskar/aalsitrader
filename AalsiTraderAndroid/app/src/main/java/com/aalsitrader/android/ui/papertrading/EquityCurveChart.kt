package com.aalsitrader.android.ui.papertrading

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.EquityPoint
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.theme.*

@Composable
fun EquityCurveChart(
    points: List<EquityPoint>,
    modifier: Modifier = Modifier,
) {
    if (points.size < 2) return

    CardSurface(modifier = modifier) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Equity Curve",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = TextPrimary,
            )
            Spacer(modifier = Modifier.height(12.dp))

            val capitals = points.map { it.capital }
            val minCap = capitals.min()
            val maxCap = capitals.max()
            val range = (maxCap - minCap).coerceAtLeast(1.0)
            val isPositive = points.last().capital >= points.first().capital
            val lineColor = if (isPositive) ProfitGreen else LossRed

            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp),
            ) {
                val w = size.width
                val h = size.height
                val stepX = w / (points.size - 1).coerceAtLeast(1)

                val path = Path()
                val fillPath = Path()

                points.forEachIndexed { index, point ->
                    val x = index * stepX
                    val y = h - ((point.capital - minCap) / range * h).toFloat()
                    if (index == 0) {
                        path.moveTo(x, y)
                        fillPath.moveTo(x, y)
                    } else {
                        path.lineTo(x, y)
                        fillPath.lineTo(x, y)
                    }
                }

                // Fill area
                fillPath.lineTo(w, h)
                fillPath.lineTo(0f, h)
                fillPath.close()

                drawPath(
                    path = fillPath,
                    brush = Brush.verticalGradient(
                        colors = listOf(lineColor.copy(alpha = 0.3f), lineColor.copy(alpha = 0.0f)),
                    ),
                )

                // Line
                drawPath(
                    path = path,
                    color = lineColor,
                    style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round),
                )
            }
        }
    }
}
