package com.aalsitrader.android.ui.admin

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.PlanStatus
import com.aalsitrader.android.model.User
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.PillBadge
import com.aalsitrader.android.ui.theme.*

@Composable
fun UserRow(
    user: User,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    CardSurface(modifier = modifier.clickable(onClick = onClick)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = user.username.ifBlank { user.email },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary,
                )
                Text(
                    text = user.email,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                user.plan?.let {
                    PillBadge(text = it.name.uppercase(), color = AccentCyan)
                }
                Spacer(modifier = Modifier.height(4.dp))
                PillBadge(
                    text = user.role.name.uppercase(),
                    color = if (user.role == com.aalsitrader.android.model.UserRole.admin) GammaPurple else TextSecondary,
                )
            }
        }
    }
}
