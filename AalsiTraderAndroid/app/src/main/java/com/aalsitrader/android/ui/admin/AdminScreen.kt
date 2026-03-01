package com.aalsitrader.android.ui.admin

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
import com.aalsitrader.android.viewmodel.AdminViewModel

@Composable
fun AdminScreen(
    viewModel: AdminViewModel = viewModel(),
) {
    val stats by viewModel.stats.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()

    val filteredUsers = remember(viewModel.users.collectAsState().value, searchQuery) {
        viewModel.filteredUsers()
    }

    Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = "Admin Panel",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
            )

            error?.let { ErrorBanner(message = it, onDismiss = { viewModel.clearError() }) }

            // Overview Stats
            stats?.let { AdminOverview(stats = it) }

            // Search
            SearchBar(
                query = searchQuery,
                onQueryChange = { viewModel.setSearchQuery(it) },
                placeholder = "Search users...",
            )

            // Users
            UserList(
                users = filteredUsers,
                viewModel = viewModel,
            )

            Spacer(modifier = Modifier.height(80.dp))
        }
}
