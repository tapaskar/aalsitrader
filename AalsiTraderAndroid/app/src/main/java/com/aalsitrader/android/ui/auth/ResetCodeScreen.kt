package com.aalsitrader.android.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aalsitrader.android.ui.components.ErrorBanner
import com.aalsitrader.android.ui.theme.*
import com.aalsitrader.android.viewmodel.AuthViewModel

@Composable
fun ResetCodeScreen(
    authViewModel: AuthViewModel,
    onNavigateToLogin: () -> Unit,
    onNavigateBack: () -> Unit,
) {
    var resetCode by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    val isLoading by authViewModel.isLoading.collectAsState()
    val error by authViewModel.error.collectAsState()
    val message by authViewModel.message.collectAsState()
    val resetEmail by authViewModel.resetEmail.collectAsState()
    val resetSuccess by authViewModel.resetSuccess.collectAsState()
    val focusManager = LocalFocusManager.current

    val passwordsMatch = newPassword == confirmPassword
    val canSubmit = resetCode.length == 6 && newPassword.length >= 6 && passwordsMatch && !isLoading

    LaunchedEffect(resetSuccess) {
        if (resetSuccess) {
            // Wait briefly so user sees the success message, then navigate to login
            kotlinx.coroutines.delay(1500)
            authViewModel.clearResetState()
            authViewModel.clearMessage()
            onNavigateToLogin()
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
            text = "Enter Reset Code",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "We sent a 6-digit code to",
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary,
        )
        Text(
            text = resetEmail ?: "",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = AccentCyan,
        )
        Spacer(modifier = Modifier.height(32.dp))

        error?.let {
            ErrorBanner(message = it, onDismiss = { authViewModel.clearError() })
            Spacer(modifier = Modifier.height(16.dp))
        }

        message?.let {
            if (resetSuccess) {
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
        }

        // Reset code field
        OutlinedTextField(
            value = resetCode,
            onValueChange = { if (it.length <= 6 && it.all { c -> c.isDigit() }) resetCode = it },
            label = { Text("6-Digit Code") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Number,
                imeAction = ImeAction.Next,
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) },
            ),
            modifier = Modifier.fillMaxWidth(),
            colors = authTextFieldColors(),
            shape = RoundedCornerShape(12.dp),
        )
        Spacer(modifier = Modifier.height(16.dp))

        // New password field
        OutlinedTextField(
            value = newPassword,
            onValueChange = { newPassword = it },
            label = { Text("New Password") },
            singleLine = true,
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                        contentDescription = if (passwordVisible) "Hide password" else "Show password",
                        tint = TextMuted,
                    )
                }
            },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Next,
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) },
            ),
            modifier = Modifier.fillMaxWidth(),
            colors = authTextFieldColors(),
            shape = RoundedCornerShape(12.dp),
        )
        Spacer(modifier = Modifier.height(16.dp))

        // Confirm password field
        OutlinedTextField(
            value = confirmPassword,
            onValueChange = { confirmPassword = it },
            label = { Text("Confirm Password") },
            singleLine = true,
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            isError = confirmPassword.isNotEmpty() && !passwordsMatch,
            supportingText = if (confirmPassword.isNotEmpty() && !passwordsMatch) {
                { Text("Passwords don't match", color = StatusDanger) }
            } else null,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(
                onDone = {
                    focusManager.clearFocus()
                    if (canSubmit && resetEmail != null) {
                        authViewModel.resetPassword(resetEmail!!, resetCode, newPassword)
                    }
                },
            ),
            modifier = Modifier.fillMaxWidth(),
            colors = authTextFieldColors(),
            shape = RoundedCornerShape(12.dp),
        )
        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                if (resetEmail != null) {
                    authViewModel.resetPassword(resetEmail!!, resetCode, newPassword)
                }
            },
            enabled = canSubmit,
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
                Text("Reset Password", fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(modifier = Modifier.height(16.dp))

        TextButton(onClick = {
            authViewModel.clearMessage()
            authViewModel.clearError()
            onNavigateBack()
        }) {
            Text("Back", color = AccentCyan)
        }
    }
}
