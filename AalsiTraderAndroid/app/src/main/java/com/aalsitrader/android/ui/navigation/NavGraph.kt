package com.aalsitrader.android.ui.navigation

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.aalsitrader.android.ui.auth.AuthContainerScreen
import com.aalsitrader.android.ui.dashboard.DashboardScreen
import com.aalsitrader.android.ui.papertrading.PaperTradingScreen
import com.aalsitrader.android.ui.papertrading.TradingRulesScreen
import com.aalsitrader.android.ui.screener.ScreenerScreen
import com.aalsitrader.android.ui.straddle.StraddleScreen
import com.aalsitrader.android.ui.admin.AdminScreen
import com.aalsitrader.android.ui.profile.ProfileScreen
import com.aalsitrader.android.ui.profile.BrokerCredentialsScreen
import com.aalsitrader.android.ui.profile.BrokerPortfolioScreen
import com.aalsitrader.android.ui.profile.SettingsScreen
import com.aalsitrader.android.ui.chat.PrimeChatScreen
import com.aalsitrader.android.ui.MoreScreen
import com.aalsitrader.android.ui.OnboardingScreen
import com.aalsitrader.android.ui.components.FloatingChatButton
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NavGraph(
    authViewModel: AuthViewModel = viewModel(),
) {
    val navController = rememberNavController()
    val isLoggedIn by authViewModel.isLoggedIn.collectAsState()
    val currentUser by authViewModel.currentUser.collectAsState()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val showBottomBar = currentRoute in Screen.bottomNavItems.map { it.route }
    val showChatFab = showBottomBar && currentRoute != Screen.More.route

    LaunchedEffect(Unit) {
        authViewModel.checkAuth()
    }

    Scaffold(
        containerColor = AppBackground,
        bottomBar = {
            if (isLoggedIn && showBottomBar) {
                NavigationBar(
                    containerColor = CardBackground,
                    contentColor = TextPrimary,
                ) {
                    Screen.bottomNavItems.forEach { screen ->
                        val selected = currentRoute == screen.route
                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = screen.icon!!,
                                    contentDescription = screen.title,
                                )
                            },
                            label = {
                                Text(
                                    screen.title,
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            },
                            selected = selected,
                            onClick = {
                                if (currentRoute != screen.route) {
                                    navController.navigate(screen.route) {
                                        popUpTo(Screen.Dashboard.route) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = AccentCyan,
                                selectedTextColor = AccentCyan,
                                unselectedIconColor = TextMuted,
                                unselectedTextColor = TextMuted,
                                indicatorColor = Color.Transparent,
                            ),
                        )
                    }
                }
            }
        },
        floatingActionButton = {
            if (isLoggedIn && showChatFab) {
                FloatingChatButton(
                    onClick = { navController.navigate(Screen.PrimeChat.route) }
                )
            }
        },
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = if (isLoggedIn) Screen.Dashboard.route else Screen.Auth.route,
            modifier = Modifier.padding(paddingValues),
        ) {
            composable(Screen.Auth.route) {
                AuthContainerScreen(
                    authViewModel = authViewModel,
                    onLoginSuccess = {
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(Screen.Auth.route) { inclusive = true }
                        }
                    },
                )
            }
            composable(Screen.Dashboard.route) {
                DashboardScreen(navController = navController)
            }
            composable(Screen.PaperTrading.route) {
                PaperTradingScreen()
            }
            composable(Screen.Screener.route) {
                ScreenerScreen()
            }
            composable(Screen.Straddle.route) {
                StraddleScreen()
            }
            composable(Screen.More.route) {
                MoreScreen(
                    navController = navController,
                    authViewModel = authViewModel,
                    isAdmin = currentUser?.role == com.aalsitrader.android.model.UserRole.admin,
                )
            }
            composable(Screen.Admin.route) {
                AdminScreen()
            }
            composable(Screen.Profile.route) {
                ProfileScreen(
                    navController = navController,
                    authViewModel = authViewModel,
                )
            }
            composable(Screen.BrokerCredentials.route) {
                BrokerCredentialsScreen(authViewModel = authViewModel)
            }
            composable(Screen.BrokerPortfolio.route) {
                BrokerPortfolioScreen()
            }
            composable(Screen.Settings.route) {
                SettingsScreen(authViewModel = authViewModel)
            }
            composable(Screen.TradingRules.route) {
                TradingRulesScreen()
            }
            composable(Screen.PrimeChat.route) {
                PrimeChatScreen()
            }
            composable(Screen.Onboarding.route) {
                OnboardingScreen(
                    onComplete = { navController.popBackStack() },
                )
            }
        }
    }

    // Handle auth state changes
    LaunchedEffect(isLoggedIn) {
        if (!isLoggedIn && currentRoute != Screen.Auth.route) {
            navController.navigate(Screen.Auth.route) {
                popUpTo(0) { inclusive = true }
            }
        }
    }
}
