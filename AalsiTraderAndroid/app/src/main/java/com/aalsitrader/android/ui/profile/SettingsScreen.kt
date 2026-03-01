package com.aalsitrader.android.ui.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.UserSettings
import com.aalsitrader.android.network.ProfileUpdateRequest
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.AuthViewModel

@Composable
fun SettingsScreen(
    authViewModel: AuthViewModel,
) {
    val user by authViewModel.currentUser.collectAsState()
    val settings = user?.settings ?: UserSettings()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "Settings",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
        )

        CardSurface {
            Column(modifier = Modifier.padding(16.dp)) {
                SettingsToggle(
                    title = "Require Sigma Approval",
                    subtitle = "Require manual approval before trade execution",
                    checked = settings.requireSigmaApproval,
                    onToggle = { newVal ->
                        authViewModel.updateProfile(
                            ProfileUpdateRequest(settings = settings.copy(requireSigmaApproval = newVal))
                        )
                    },
                )
                Divider(color = AppBorder.copy(alpha = 0.2f))
                SettingsToggle(
                    title = "Sound Enabled",
                    subtitle = "Play sounds on alerts and notifications",
                    checked = settings.soundEnabled,
                    onToggle = { newVal ->
                        authViewModel.updateProfile(
                            ProfileUpdateRequest(settings = settings.copy(soundEnabled = newVal))
                        )
                    },
                )
                Divider(color = AppBorder.copy(alpha = 0.2f))
                SettingsToggle(
                    title = "Email Opt Out",
                    subtitle = "Stop receiving email notifications",
                    checked = user?.emailOptOut ?: false,
                    onToggle = { newVal ->
                        authViewModel.updateProfile(ProfileUpdateRequest(emailOptOut = newVal))
                    },
                )
            }
        }
    }
}

@Composable
private fun SettingsToggle(
    title: String,
    subtitle: String,
    checked: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = MaterialTheme.typography.titleSmall, color = TextPrimary)
            Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = TextMuted)
        }
        Switch(
            checked = checked,
            onCheckedChange = onToggle,
            colors = SwitchDefaults.colors(
                checkedTrackColor = AccentCyan,
                checkedThumbColor = TextPrimary,
                uncheckedTrackColor = CardHover,
                uncheckedThumbColor = TextMuted,
            ),
        )
    }
}
