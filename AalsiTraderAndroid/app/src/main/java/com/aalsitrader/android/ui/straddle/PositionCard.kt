package com.aalsitrader.android.ui.straddle

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.StraddlePosition
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.ModeIndicator
import com.aalsitrader.android.ui.components.PnLText
import com.aalsitrader.android.ui.papertrading.DetailRow
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.util.inrFormatted

@Composable
fun PositionCard(
    position: StraddlePosition,
    modifier: Modifier = Modifier,
) {
    CardSurface(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "Current Position",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary,
                )
                ModeIndicator(mode = position.mode)
            }

            // P&L
            Text("Unrealized P&L", style = MaterialTheme.typography.labelSmall, color = TextMuted)
            PnLText(value = position.unrealizedPnl, style = MaterialTheme.typography.titleLarge)

            Divider(color = AppBorder.copy(alpha = 0.3f))

            // Leg details
            DetailRow("CE Strike", String.format("%.0f", position.ceStrike))
            DetailRow("PE Strike", String.format("%.0f", position.peStrike))
            DetailRow("CE Entry", position.ceEntryPremium.inrFormatted())
            DetailRow("PE Entry", position.peEntryPremium.inrFormatted())
            DetailRow("CE Current", position.ceCurPremium.inrFormatted())
            DetailRow("PE Current", position.peCurPremium.inrFormatted())
            DetailRow("Total Collected", position.totalCollected.inrFormatted())
            DetailRow("Nifty Entry", String.format("%.2f", position.niftyEntry))
            DetailRow("Entry Time", position.entryTime)

            // Multi-leg details
            position.legs?.let { legs ->
                if (legs.isNotEmpty()) {
                    Divider(color = AppBorder.copy(alpha = 0.3f))
                    Text("Legs", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                    legs.forEach { leg ->
                        DetailRow(
                            "${leg.action} ${leg.side} ${String.format("%.0f", leg.strikePrice)}",
                            "Entry: ${leg.entryPremium.inrFormatted()} | Cur: ${leg.curPremium.inrFormatted()}"
                        )
                    }
                }
            }
        }
    }
}
