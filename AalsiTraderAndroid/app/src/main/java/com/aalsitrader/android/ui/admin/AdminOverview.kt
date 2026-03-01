package com.aalsitrader.android.ui.admin

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.network.AdminStats
import com.aalsitrader.android.ui.components.StatCard
import com.aalsitrader.android.ui.theme.AccentCyan
import com.aalsitrader.android.ui.theme.ProfitGreen
import com.aalsitrader.android.ui.theme.StatusWarning

@Composable
fun AdminOverview(
    stats: AdminStats,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatCard(label = "Total Users", value = "${stats.totalUsers}", valueColor = AccentCyan, modifier = Modifier.weight(1f))
            StatCard(label = "Active", value = "${stats.activeUsers}", valueColor = ProfitGreen, modifier = Modifier.weight(1f))
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatCard(label = "Trial", value = "${stats.trialUsers}", valueColor = StatusWarning, modifier = Modifier.weight(1f))
            StatCard(label = "Paid", value = "${stats.paidUsers}", valueColor = ProfitGreen, modifier = Modifier.weight(1f))
        }
    }
}
