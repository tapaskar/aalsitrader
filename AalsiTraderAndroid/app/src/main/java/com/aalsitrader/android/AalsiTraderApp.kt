package com.aalsitrader.android

import android.app.Application

class AalsiTraderApp : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: AalsiTraderApp
            private set
    }
}
