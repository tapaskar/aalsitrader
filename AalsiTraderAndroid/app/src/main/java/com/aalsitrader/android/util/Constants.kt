package com.aalsitrader.android.util

object Constants {
    const val API_BASE_URL = "https://kzdbk5z09k.execute-api.ap-south-1.amazonaws.com/prod/"
    const val WS_BASE_URL = "wss://kzdbk5z09k.execute-api.ap-south-1.amazonaws.com/prod"

    const val DASHBOARD_POLL_INTERVAL = 30_000L   // 30 seconds
    const val STRADDLE_POLL_INTERVAL = 10_000L    // 10 seconds
    const val BROKER_POLL_INTERVAL = 60_000L      // 60 seconds
    const val WS_RECONNECT_DELAY = 5_000L         // 5 seconds

    const val PREFS_NAME = "com.aalsitrader.android"
    const val TOKEN_KEY = "jwt_token"
}
