package com.aalsitrader.android.ui.papertrading

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aalsitrader.android.ui.components.*
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.PaperTradingViewModel

@Composable
fun PaperTradingScreen(
    viewModel: PaperTradingViewModel = viewModel(),
) {
    val portfolio by viewModel.portfolio.collectAsState()
    val trades by viewModel.trades.collectAsState()
    val metrics by viewModel.metrics.collectAsState()
    val equityCurve by viewModel.equityCurve.collectAsState()
    val approvals by viewModel.approvals.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val selectedTab by viewModel.selectedTab.collectAsState()
    val mode by viewModel.mode.collectAsState()

    val tabs = listOf("Portfolio", "Trades", "Metrics", "Approvals")

    Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "Paper Trading",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                )
                ModeIndicator(
                    mode = if (mode == "live")
                        com.aalsitrader.android.model.TradingMode.live
                    else
                        com.aalsitrader.android.model.TradingMode.paper
                )
            }

            error?.let {
                ErrorBanner(
                    message = it,
                    onDismiss = { viewModel.clearError() },
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            // Tabs
            ScrollableTabRow(
                selectedTabIndex = selectedTab,
                containerColor = AppBackground,
                contentColor = AccentCyan,
                edgePadding = 16.dp,
                indicator = {},
                divider = {},
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { viewModel.setTab(index) },
                        text = {
                            Text(
                                title,
                                color = if (selectedTab == index) AccentCyan else TextMuted,
                                fontWeight = if (selectedTab == index) FontWeight.SemiBold else FontWeight.Normal,
                            )
                        },
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Content
            when (selectedTab) {
                0 -> {
                    portfolio?.let { PortfolioSummary(portfolio = it) }
                    Spacer(modifier = Modifier.height(16.dp))
                    if (equityCurve.isNotEmpty()) {
                        EquityCurveChart(
                            points = equityCurve,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(200.dp)
                                .padding(horizontal = 16.dp),
                        )
                    }
                }
                1 -> TradeHistory(trades = trades)
                2 -> metrics?.let { PerformanceMetrics(metrics = it) }
                3 -> SigmaApprovals(
                    approvals = approvals,
                    onApprove = { viewModel.approveTrade(it) },
                    onReject = { viewModel.rejectTrade(it) },
                )
            }

            Spacer(modifier = Modifier.height(80.dp))
        }
}
