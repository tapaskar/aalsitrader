package com.aalsitrader.android.ui.profile

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
import com.aalsitrader.android.ui.papertrading.DetailRow
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.util.inrFormatted
import com.aalsitrader.android.viewmodel.BrokerPortfolioViewModel

@Composable
fun BrokerPortfolioScreen(
    viewModel: BrokerPortfolioViewModel = viewModel(),
) {
    val portfolio by viewModel.portfolio.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()

    Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "Broker Portfolio",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
            )

            error?.let { ErrorBanner(message = it, onDismiss = { viewModel.clearError() }) }

            portfolio?.let { p ->
                if (p.needsBrokerSetup == true) {
                    EmptyState(title = "Broker not connected", subtitle = "Set up broker credentials to view portfolio")
                    return@let
                }

                // Funds
                p.funds?.let { funds ->
                    CardSurface {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Funds", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                            Spacer(modifier = Modifier.height(8.dp))
                            funds.totalBalance?.let { DetailRow("Total Balance", it.inrFormatted()) }
                            funds.availableBalance?.let { DetailRow("Available", it.inrFormatted()) }
                            funds.usedMargin?.let { DetailRow("Used Margin", it.inrFormatted()) }
                            funds.dayPnl?.let {
                                DetailRow("Day P&L", it.inrFormatted())
                            }
                        }
                    }
                }

                // Positions
                p.positions?.let { positions ->
                    if (positions.isNotEmpty()) {
                        Text("Positions (${positions.size})", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                        positions.forEach { pos ->
                            CardSurface {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(pos.displaySymbol, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                                        Text("Qty: ${pos.displayQty} | Avg: ${pos.displayAvgPrice.inrFormatted()}", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                                    }
                                    PnLText(value = pos.displayPnl, style = MaterialTheme.typography.titleSmall)
                                }
                            }
                        }
                    }
                }

                // Holdings
                p.holdings?.let { holdings ->
                    if (holdings.isNotEmpty()) {
                        Text("Holdings (${holdings.size})", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                        holdings.forEach { h ->
                            CardSurface {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(h.displaySymbol, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                                        Text("Qty: ${h.quantity ?: 0}", style = MaterialTheme.typography.bodySmall, color = TextMuted)
                                    }
                                    h.pnl?.let { PnLText(value = it, style = MaterialTheme.typography.titleSmall) }
                                }
                            }
                        }
                    }
                }
            } ?: run {
                if (!isLoading) {
                    EmptyState(title = "No portfolio data")
                }
            }

            Spacer(modifier = Modifier.height(80.dp))
        }
}
