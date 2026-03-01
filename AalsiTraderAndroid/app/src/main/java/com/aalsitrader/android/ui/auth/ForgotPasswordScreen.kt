package com.aalsitrader.android.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aalsitrader.android.ui.components.ErrorBanner
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.AuthViewModel

@Composable
fun ForgotPasswordScreen(
    authViewModel: AuthViewModel,
    onNavigateToLogin: () -> Unit,
    onNavigateToResetCode: () -> Unit = {},
) {
    var email by remember { mutableStateOf("") }
    val isLoading by authViewModel.isLoading.collectAsState()
    val error by authViewModel.error.collectAsState()
    val message by authViewModel.message.collectAsState()
    val resetEmail by authViewModel.resetEmail.collectAsState()
    val focusManager = LocalFocusManager.current

    // Navigate to reset code screen when email is sent successfully
    LaunchedEffect(resetEmail) {
        if (resetEmail != null) {
            onNavigateToResetCode()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "Reset Password",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Enter your email to receive a reset code",
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary,
        )
        Spacer(modifier = Modifier.height(32.dp))

        error?.let {
            ErrorBanner(message = it, onDismiss = { authViewModel.clearError() })
            Spacer(modifier = Modifier.height(16.dp))
        }

        message?.let {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = ProfitGreen.copy(alpha = 0.15f),
            ) {
                Text(
                    text = it,
                    color = ProfitGreen,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(12.dp),
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(
                onDone = {
                    focusManager.clearFocus()
                    if (email.isNotBlank()) authViewModel.forgotPassword(email)
                },
            ),
            modifier = Modifier.fillMaxWidth(),
            colors = authTextFieldColors(),
            shape = RoundedCornerShape(12.dp),
        )
        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = { authViewModel.forgotPassword(email) },
            enabled = email.isNotBlank() && !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = AccentCyan,
                contentColor = AppBackground,
            ),
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = AppBackground,
                    strokeWidth = 2.dp,
                )
            } else {
                Text("Send Reset Code", fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(modifier = Modifier.height(16.dp))

        TextButton(onClick = {
            authViewModel.clearMessage()
            authViewModel.clearResetState()
            onNavigateToLogin()
        }) {
            Text("Back to Sign In", color = AccentCyan)
        }
    }
}
