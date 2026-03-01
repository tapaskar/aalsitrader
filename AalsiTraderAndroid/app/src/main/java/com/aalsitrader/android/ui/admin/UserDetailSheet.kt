package com.aalsitrader.android.ui.admin

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.User
import com.aalsitrader.android.ui.components.PillBadge
import com.aalsitrader.android.ui.papertrading.DetailRow
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.AdminViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UserDetailSheet(
    user: User,
    viewModel: AdminViewModel,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = CardBackground,
        contentColor = TextPrimary,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = user.username.ifBlank { "User" },
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
            )
            Text(text = user.email, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PillBadge(text = user.role.name.uppercase(), color = GammaPurple)
                user.plan?.let { PillBadge(text = it.name.uppercase(), color = AccentCyan) }
                user.planStatus?.let { PillBadge(text = it.name.uppercase(), color = StatusWarning) }
            }

            Divider(color = AppBorder.copy(alpha = 0.3f))

            DetailRow("Account", if (user.accountEnabled != false) "Enabled" else "Disabled")
            DetailRow("Live Trading", if (user.liveTradingEnabled == true) "Enabled" else "Disabled")
            user.brokerType?.let { DetailRow("Broker", it.name) }
            user.trialEndsAt?.let { DetailRow("Trial Ends", it) }

            Divider(color = AppBorder.copy(alpha = 0.3f))

            // Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = {
                        viewModel.toggleTrading(user.email, user.liveTradingEnabled != true)
                        onDismiss()
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                ) {
                    Text(
                        if (user.liveTradingEnabled == true) "Disable Trading" else "Enable Trading",
                        color = AccentCyan,
                    )
                }
                OutlinedButton(
                    onClick = {
                        viewModel.toggleAccount(user.email, user.accountEnabled == false)
                        onDismiss()
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                ) {
                    Text(
                        if (user.accountEnabled != false) "Disable Account" else "Enable Account",
                        color = StatusWarning,
                    )
                }
            }

            Button(
                onClick = {
                    viewModel.updateTrial(user.email, 14)
                    onDismiss()
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AccentCyan, contentColor = AppBackground),
            ) {
                Text("Extend Trial (14 days)")
            }
        }
    }
}
