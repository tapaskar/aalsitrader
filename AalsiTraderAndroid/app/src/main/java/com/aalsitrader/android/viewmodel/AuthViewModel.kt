package com.aalsitrader.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aalsitrader.android.model.User
import com.aalsitrader.android.network.ProfileUpdateRequest
import com.aalsitrader.android.network.TokenManager
import com.aalsitrader.android.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel : ViewModel() {
    private val repository = AuthRepository()

    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    private val _resetEmail = MutableStateFlow<String?>(null)
    val resetEmail: StateFlow<String?> = _resetEmail.asStateFlow()

    private val _resetSuccess = MutableStateFlow(false)
    val resetSuccess: StateFlow<Boolean> = _resetSuccess.asStateFlow()

    fun checkAuth() {
        if (TokenManager.hasToken()) {
            _isLoggedIn.value = true
            loadProfile()
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val response = repository.login(email.trim(), password)
                response.token?.let { TokenManager.saveToken(it) }
                _currentUser.value = response.user
                _isLoggedIn.value = true
            } catch (e: Exception) {
                _error.value = e.message ?: "Login failed"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun register(email: String, username: String, password: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val response = repository.register(email.trim(), username.trim(), password)
                response.token?.let { TokenManager.saveToken(it) }
                _currentUser.value = response.user
                _isLoggedIn.value = true
            } catch (e: Exception) {
                _error.value = e.message ?: "Registration failed"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun forgotPassword(email: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val response = repository.forgotPassword(email.trim())
                _resetEmail.value = email.trim()
                _message.value = response.message ?: "Password reset email sent"
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to send reset email"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun resetPassword(email: String, resetToken: String, newPassword: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            _resetSuccess.value = false
            try {
                val response = repository.resetPassword(email.trim(), resetToken.trim(), newPassword)
                _message.value = response.message ?: "Password reset successful"
                _resetSuccess.value = true
                _resetEmail.value = null
            } catch (e: Exception) {
                _error.value = e.message ?: "Password reset failed"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun clearResetState() {
        _resetEmail.value = null
        _resetSuccess.value = false
    }

    fun loadProfile() {
        viewModelScope.launch {
            try {
                _currentUser.value = repository.getProfile()
            } catch (e: Exception) {
                // Token may be expired
                if (e.message?.contains("401") == true || e.message?.contains("unauthorized", ignoreCase = true) == true) {
                    logout()
                }
            }
        }
    }

    fun updateProfile(request: ProfileUpdateRequest) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                _currentUser.value = repository.updateProfile(request)
                _message.value = "Profile updated"
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to update profile"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun logout() {
        TokenManager.clearToken()
        _currentUser.value = null
        _isLoggedIn.value = false
    }

    fun clearError() {
        _error.value = null
    }

    fun clearMessage() {
        _message.value = null
    }
}
