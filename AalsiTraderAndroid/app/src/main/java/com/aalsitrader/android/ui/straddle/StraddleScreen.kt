package com.aalsitrader.android.ui.straddle

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aalsitrader.android.ui.components.ErrorBanner
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.StraddleViewModel

@Composable
fun StraddleScreen(
    viewModel: StraddleViewModel = viewModel(),
) {
    val status by viewModel.status.collectAsState()
    val capital by viewModel.capital.collectAsState()
    val position by viewModel.position.collectAsState()
    val trades by viewModel.trades.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()

    Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = "Straddle Engine",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
            )

            error?.let {
                ErrorBanner(message = it, onDismiss = { viewModel.clearError() })
            }

            // Engine Status
            status?.let { EngineStatusCard(status = it) }

            // Engine Controls
            status?.let {
                EngineControl(
                    isRunning = it.engine.running,
                    onStart = { viewModel.startEngine() },
                    onStop = { viewModel.stopEngine() },
                    isLoading = isLoading,
                )
            }

            // Capital
            capital?.let { CapitalSummary(capital = it) }

            // Position
            position?.let { PositionCard(position = it) }

            // Trade History
            StraddleTradeHistory(trades = trades)

            Spacer(modifier = Modifier.height(80.dp))
        }
}
