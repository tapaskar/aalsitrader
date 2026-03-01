package com.aalsitrader.android.ui.papertrading

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.*
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.EmptyState
import com.aalsitrader.android.ui.components.PillBadge
import com.aalsitrader.android.ui.components.TimeAgoText
import com.aalsitrader.android.ui.theme.*

@Composable
fun SigmaApprovals(
    approvals: List<SigmaApproval>,
    onApprove: (String) -> Unit,
    onReject: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val pendingApprovals = approvals.filter { it.status == ApprovalStatus.pending }

    if (approvals.isEmpty()) {
        EmptyState(title = "No approvals", subtitle = "Trade approvals will appear here")
        return
    }

    LazyColumn(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(max = 600.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(approvals, key = { it.tradeId }) { approval ->
            CardSurface {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = approval.symbol,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary,
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        PillBadge(
                            text = approval.signal.name,
                            color = if (approval.signal == TradeSignal.BUY) ProfitGreen else LossRed,
                        )
                        Spacer(modifier = Modifier.weight(1f))
                        PillBadge(
                            text = approval.status.name.uppercase(),
                            color = when (approval.status) {
                                ApprovalStatus.pending -> StatusWarning
                                ApprovalStatus.approved -> ProfitGreen
                                ApprovalStatus.rejected -> LossRed
                            },
                        )
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Entry: \u20B9${String.format("%.2f", approval.entryPrice)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                    )
                    TimeAgoText(timestamp = approval.timestamp)

                    if (approval.status == ApprovalStatus.pending) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            OutlinedButton(
                                onClick = { onReject(approval.tradeId) },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = LossRed),
                            ) {
                                Text("Reject")
                            }
                            Button(
                                onClick = { onApprove(approval.tradeId) },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = ProfitGreen, contentColor = AppBackground),
                            ) {
                                Text("Approve")
                            }
                        }
                    }
                }
            }
        }
    }
}
