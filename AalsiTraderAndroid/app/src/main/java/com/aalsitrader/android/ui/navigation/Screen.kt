package com.aalsitrader.android.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector? = null) {
    data object Auth : Screen("auth", "Auth")
    data object Login : Screen("login", "Login")
    data object Register : Screen("register", "Register")
    data object ForgotPassword : Screen("forgot_password", "Forgot Password")

    data object Dashboard : Screen("dashboard", "Dashboard", Icons.Default.Dashboard)
    data object PaperTrading : Screen("paper_trading", "Paper Trading", Icons.Default.ShowChart)
    data object Screener : Screen("screener", "Screener", Icons.Default.Search)
    data object Straddle : Screen("straddle", "Straddle", Icons.Default.CandlestickChart)
    data object More : Screen("more", "More", Icons.Default.MoreHoriz)

    data object Admin : Screen("admin", "Admin")
    data object Profile : Screen("profile", "Profile")
    data object BrokerCredentials : Screen("broker_credentials", "Broker Credentials")
    data object BrokerPortfolio : Screen("broker_portfolio", "Broker Portfolio")
    data object Settings : Screen("settings", "Settings")
    data object TradingRules : Screen("trading_rules", "Trading Rules")
    data object PrimeChat : Screen("prime_chat", "Prime Chat")
    data object Onboarding : Screen("onboarding", "Onboarding")

    companion object {
        val bottomNavItems = listOf(Dashboard, PaperTrading, Screener, Straddle, More)
    }
}
