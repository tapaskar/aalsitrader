package com.aalsitrader.android.ui.papertrading

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aalsitrader.android.ui.components.CardSurface
import com.aalsitrader.android.ui.components.ErrorBanner
import com.aalsitrader.android.ui.components.LoadingView
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.TradingRulesViewModel

@Composable
fun TradingRulesScreen(
    viewModel: TradingRulesViewModel = viewModel(),
) {
    val rules by viewModel.rules.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()

    if (isLoading && rules == null) {
        LoadingView()
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "Trading Rules",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
        )

        error?.let {
            ErrorBanner(message = it, onDismiss = { viewModel.clearError() })
        }

        rules?.let { r ->
            // Entry Rules
            r.entryRules?.let { entries ->
                RulesSection(title = "Entry Rules", rules = entries)
            }

            // Exit Rules
            r.exitRules?.let { exits ->
                RulesSection(title = "Exit Rules", rules = exits)
            }

            // Risk Rules
            r.riskRules?.let { risks ->
                RulesSection(title = "Risk Rules", rules = risks)
            }

            // Config
            r.config?.let { config ->
                CardSurface {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Configuration", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                        Spacer(modifier = Modifier.height(8.dp))
                        config.startingCapital?.let { DetailRow("Starting Capital", "\u20B9${String.format("%.0f", it)}") }
                        config.maxRiskPerTradePct?.let { DetailRow("Max Risk/Trade", "${String.format("%.1f", it)}%") }
                        config.dailyLossLimitPct?.let { DetailRow("Daily Loss Limit", "${String.format("%.1f", it)}%") }
                        config.maxPositions?.let { DetailRow("Max Positions", "$it") }
                        config.minRewardRiskRatio?.let { DetailRow("Min R:R Ratio", "${String.format("%.1f", it)}") }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
private fun RulesSection(title: String, rules: List<String>) {
    CardSurface {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = AccentCyan)
            Spacer(modifier = Modifier.height(8.dp))
            rules.forEach { rule ->
                Text(
                    text = "• $rule",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                    modifier = Modifier.padding(vertical = 2.dp),
                )
            }
        }
    }
}
