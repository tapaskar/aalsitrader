package com.aalsitrader.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.navigation.Screen
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.AuthViewModel

@Composable
fun MoreScreen(
    navController: NavController,
    authViewModel: AuthViewModel,
    isAdmin: Boolean,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "More",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
        )

        MoreMenuItem(
            icon = Icons.Default.Person,
            title = "Profile",
            onClick = { navController.navigate(Screen.Profile.route) },
        )
        MoreMenuItem(
            icon = Icons.Default.Rule,
            title = "Trading Rules",
            onClick = { navController.navigate(Screen.TradingRules.route) },
        )
        MoreMenuItem(
            icon = Icons.Default.AccountBalance,
            title = "Broker Portfolio",
            onClick = { navController.navigate(Screen.BrokerPortfolio.route) },
        )
        MoreMenuItem(
            icon = Icons.Default.Chat,
            title = "Chat with Prime",
            onClick = { navController.navigate(Screen.PrimeChat.route) },
        )
        MoreMenuItem(
            icon = Icons.Default.Settings,
            title = "Settings",
            onClick = { navController.navigate(Screen.Settings.route) },
        )

        if (isAdmin) {
            Spacer(modifier = Modifier.height(8.dp))
            Text("Admin", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = GammaPurple)
            MoreMenuItem(
                icon = Icons.Default.AdminPanelSettings,
                title = "Admin Panel",
                onClick = { navController.navigate(Screen.Admin.route) },
                iconTint = GammaPurple,
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Logout
        Button(
            onClick = { authViewModel.logout() },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = LossRed.copy(alpha = 0.15f),
                contentColor = LossRed,
            ),
        ) {
            Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Sign Out", fontWeight = FontWeight.SemiBold)
        }

        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
private fun MoreMenuItem(
    icon: ImageVector,
    title: String,
    onClick: () -> Unit,
    iconTint: androidx.compose.ui.graphics.Color = AccentCyan,
) {
    CardSurface(modifier = Modifier.clickable(onClick = onClick)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(24.dp))
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Medium,
                color = TextPrimary,
                modifier = Modifier.weight(1f),
            )
            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextMuted)
        }
    }
}
