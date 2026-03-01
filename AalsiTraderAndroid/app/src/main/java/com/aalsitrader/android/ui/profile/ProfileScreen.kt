package com.aalsitrader.android.ui.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.PillBadge
import com.aalsitrader.android.ui.navigation.Screen
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.AuthViewModel

@Composable
fun ProfileScreen(
    navController: NavController,
    authViewModel: AuthViewModel,
) {
    val user by authViewModel.currentUser.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = "Profile",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
        )

        // User Info
        user?.let { u ->
            CardSurface {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = u.username.ifBlank { "User" },
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                    )
                    Text(text = u.email, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        u.plan?.let { PillBadge(text = it.name.uppercase(), color = AccentCyan) }
                        u.planStatus?.let { PillBadge(text = it.name.uppercase(), color = StatusWarning) }
                        PillBadge(text = u.role.name.uppercase(), color = GammaPurple)
                    }
                }
            }
        }

        // Menu Items
        ProfileMenuItem(
            icon = Icons.Default.Key,
            title = "Broker Credentials",
            subtitle = "Manage broker connections",
            onClick = { navController.navigate(Screen.BrokerCredentials.route) },
        )
        ProfileMenuItem(
            icon = Icons.Default.AccountBalance,
            title = "Broker Portfolio",
            subtitle = "View positions & holdings",
            onClick = { navController.navigate(Screen.BrokerPortfolio.route) },
        )
        ProfileMenuItem(
            icon = Icons.Default.Settings,
            title = "Settings",
            subtitle = "App preferences",
            onClick = { navController.navigate(Screen.Settings.route) },
        )
    }
}

@Composable
private fun ProfileMenuItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    CardSurface {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .then(Modifier.let { modifier ->
                    modifier
                }),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = AccentCyan, modifier = Modifier.size(24.dp))
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Medium, color = TextPrimary)
                Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = TextMuted)
            }
            IconButton(onClick = onClick) {
                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextMuted)
            }
        }
    }
}
