package com.aalsitrader.android.network

sealed class ApiError : Exception() {
    data object InvalidResponse : ApiError() {
        private fun readResolve(): Any = InvalidResponse
        override val message: String get() = "Invalid server response"
    }

    data object Unauthorized : ApiError() {
        private fun readResolve(): Any = Unauthorized
        override val message: String get() = "Session expired. Please log in again."
    }

    data class ServerError(val code: Int, val body: String) : ApiError() {
        override val message: String get() = body.ifBlank { "Server error ($code)" }
    }

    data class DecodingError(val throwable: Throwable) : ApiError() {
        override val message: String get() = "Failed to parse response: ${throwable.message}"
    }

    data class NetworkError(val throwable: Throwable) : ApiError() {
        override val message: String get() = "Network error: ${throwable.message}"
    }
}
