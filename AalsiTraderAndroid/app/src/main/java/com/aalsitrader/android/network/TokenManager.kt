package com.aalsitrader.android.network

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.aalsitrader.android.AalsiTraderApp
import com.aalsitrader.android.util.Constants

object TokenManager {
    private val prefs: SharedPreferences by lazy {
        val context = AalsiTraderApp.instance
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            Constants.PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun getToken(): String? = prefs.getString(Constants.TOKEN_KEY, null)

    fun saveToken(token: String) {
        prefs.edit().putString(Constants.TOKEN_KEY, token).apply()
    }

    fun clearToken() {
        prefs.edit().remove(Constants.TOKEN_KEY).apply()
    }

    fun hasToken(): Boolean = getToken() != null
}
