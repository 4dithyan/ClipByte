package com.clipbyte.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

/**
 * ClipByteApp — Application entry point.
 * Firebase auto-initialises from google-services.json.
 * We only create the notification channel here so it is
 * available before any service starts.
 */
class ClipByteApp : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ClipByte Monitor",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Syncing clipboard in the background"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)
                ?.createNotificationChannel(channel)
        }
    }

    companion object {
        const val CHANNEL_ID = "clipbyte_monitor"
    }
}
