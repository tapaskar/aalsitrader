package com.aalsitrader.android.ui.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aalsitrader.android.model.BrokerType
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.AuthViewModel

@Composable
fun BrokerCredentialsScreen(
    authViewModel: AuthViewModel,
) {
    val user by authViewModel.currentUser.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "Broker Credentials",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
        )
        Text(
            text = "Connect your broker to enable live trading",
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary,
        )

        Spacer(modifier = Modifier.height(8.dp))

        val brokers = listOf(
            BrokerInfo("Zerodha", user?.hasZerodhaCredentials == true),
            BrokerInfo("Motilal Oswal", user?.hasMotilalCredentials == true),
            BrokerInfo("Dhan", user?.hasDhanCredentials == true),
            BrokerInfo("Angel One", user?.hasAngelOneCredentials == true),
            BrokerInfo("Upstox", user?.hasUpstoxCredentials == true),
        )

        brokers.forEach { broker ->
            CardSurface {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = if (broker.connected) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                        contentDescription = null,
                        tint = if (broker.connected) ProfitGreen else TextMuted,
                        modifier = Modifier.size(24.dp),
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = broker.name,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Medium,
                            color = TextPrimary,
                        )
                        Text(
                            text = if (broker.connected) "Connected" else "Not connected",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (broker.connected) ProfitGreen else TextMuted,
                        )
                    }
                }
            }
        }
    }
}

private data class BrokerInfo(val name: String, val connected: Boolean)
