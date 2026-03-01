package com.aalsitrader.android.ui.auth

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.aalsitrader.android.viewmodel.AuthViewModel

enum class AuthPage { Login, Register, ForgotPassword }

@Composable
fun AuthContainerScreen(
    authViewModel: AuthViewModel,
    onLoginSuccess: () -> Unit,
) {
    var currentPage by remember { mutableStateOf(AuthPage.Login) }
    val isLoggedIn by authViewModel.isLoggedIn.collectAsState()

    LaunchedEffect(isLoggedIn) {
        if (isLoggedIn) onLoginSuccess()
    }

    AnimatedContent(
        targetState = currentPage,
        transitionSpec = {
            slideInHorizontally { it } + fadeIn() togetherWith
                    slideOutHorizontally { -it } + fadeOut()
        },
        label = "auth_page",
    ) { page ->
        when (page) {
            AuthPage.Login -> LoginScreen(
                authViewModel = authViewModel,
                onNavigateToRegister = { currentPage = AuthPage.Register },
                onNavigateToForgotPassword = { currentPage = AuthPage.ForgotPassword },
            )
            AuthPage.Register -> RegisterScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = { currentPage = AuthPage.Login },
            )
            AuthPage.ForgotPassword -> ForgotPasswordScreen(
                authViewModel = authViewModel,
                onNavigateToLogin = { currentPage = AuthPage.Login },
            )
        }
    }
}
