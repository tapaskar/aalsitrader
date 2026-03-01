package com.aalsitrader.android.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.aalsitrader.android.ui.components.*
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.DashboardViewModel

@Composable
fun DashboardScreen(
    navController: NavController,
    viewModel: DashboardViewModel = viewModel(),
) {
    val agents by viewModel.agents.collectAsState()
    val activities by viewModel.activities.collectAsState()
    val comms by viewModel.comms.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val selectedFilter by viewModel.selectedFilter.collectAsState()
    var showAgentDetail by remember { mutableStateOf<String?>(null) }
    var showComms by remember { mutableStateOf(false) }

    val filteredActivities = remember(activities, selectedFilter) {
        if (selectedFilter == null) activities
        else activities.filter { it.agentId == selectedFilter }
    }

    Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(16.dp))

            // Market Data Bar
            MarketDataBar()

            Spacer(modifier = Modifier.height(16.dp))

            // Title
            Text(
                text = "Dashboard",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
            )
            Spacer(modifier = Modifier.height(16.dp))

            // Error
            error?.let {
                ErrorBanner(message = it, onDismiss = { viewModel.clearError() })
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Quick Stats
            QuickStatsRow(activities = activities, agents = agents)
            Spacer(modifier = Modifier.height(16.dp))

            // Agents
            Text(
                text = "AI Agents",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = TextPrimary,
            )
            Spacer(modifier = Modifier.height(8.dp))
            AgentListSection(
                agents = agents,
                onAgentClick = { showAgentDetail = it.id },
            )
            Spacer(modifier = Modifier.height(16.dp))

            // Filter + Activity Feed Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "Activity Feed",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary,
                )
                TextButton(onClick = { showComms = !showComms }) {
                    Text(
                        if (showComms) "Activity" else "Comms",
                        color = AccentCyan,
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))

            FilterBar(
                agents = agents,
                selectedFilter = selectedFilter,
                onFilterSelected = { viewModel.setFilter(it) },
            )
            Spacer(modifier = Modifier.height(8.dp))

            if (showComms) {
                CommPanel(comms = comms)
            } else {
                ActivityFeed(activities = filteredActivities)
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Recent Trades
            RecentTradesSection(activities = activities)
            Spacer(modifier = Modifier.height(80.dp))
        }

    // Agent Detail Sheet
    showAgentDetail?.let { agentId ->
        agents.find { it.id == agentId }?.let { agent ->
            AgentDetailSheet(
                agent = agent,
                activities = activities.filter { it.agentId == agentId },
                onDismiss = { showAgentDetail = null },
            )
        }
    }
}
