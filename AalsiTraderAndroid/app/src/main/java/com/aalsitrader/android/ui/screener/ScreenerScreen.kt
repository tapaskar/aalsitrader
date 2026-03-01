package com.aalsitrader.android.ui.screener

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aalsitrader.android.model.SmartMoneyStock
import com.aalsitrader.android.ui.components.*
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.ScreenerViewModel

@Composable
fun ScreenerScreen(
    viewModel: ScreenerViewModel = viewModel(),
) {
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val signalFilter by viewModel.signalFilter.collectAsState()
    var selectedStock by remember { mutableStateOf<SmartMoneyStock?>(null) }

    val filteredStocks = remember(
        viewModel.stocks.collectAsState().value,
        searchQuery,
        signalFilter,
        viewModel.sortBy.collectAsState().value,
    ) {
        viewModel.filteredStocks()
    }

    Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Text(
                text = "Smart Money Screener",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
                modifier = Modifier.padding(16.dp),
            )

            error?.let {
                ErrorBanner(
                    message = it,
                    onDismiss = { viewModel.clearError() },
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            // Search
            SearchBar(
                query = searchQuery,
                onQueryChange = { viewModel.setSearchQuery(it) },
                placeholder = "Search stocks...",
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Filters
            ScreenerFilterBar(
                signalFilter = signalFilter,
                onSignalFilterChange = { viewModel.setSignalFilter(it) },
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Summary
            ScreenerSummaryCards(stocks = filteredStocks)
            Spacer(modifier = Modifier.height(8.dp))

            // Stock List
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(filteredStocks, key = { it.symbol }) { stock ->
                    StockRow(
                        stock = stock,
                        onClick = {
                            selectedStock = stock
                            viewModel.loadChart(stock.symbol)
                        },
                    )
                }
                item { Spacer(modifier = Modifier.height(80.dp)) }
            }
        }

    // Stock Detail Sheet
    selectedStock?.let { stock ->
        val chartData by viewModel.chartData.collectAsState()
        StockDetailSheet(
            stock = stock,
            chartData = chartData,
            onDismiss = { selectedStock = null },
        )
    }
}
