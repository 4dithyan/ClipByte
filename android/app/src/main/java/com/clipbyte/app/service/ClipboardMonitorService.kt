package com.clipbyte.app.service

import android.app.*
import android.content.*
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.clipbyte.app.ClipByteApp
import com.clipbyte.app.R
import com.clipbyte.app.data.repository.ClipboardRepository
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.*

/**
 * ClipboardMonitorService — foreground service that monitors the clipboard.
 *
 * On Android 10+ reading the clipboard from a background thread is restricted;
 * we access it on the main thread via a Handler post, then upload on IO.
 */
class ClipboardMonitorService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val mainScope    = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private val repository by lazy {
        ClipboardRepository(
            db   = FirebaseFirestore.getInstance(),
            auth = FirebaseAuth.getInstance()
        )
    }

    private var lastHash: Int = -1
    private val POLL_MS  = 1000L   // 1 s — slightly less aggressive
    private val NOTIF_ID = 101

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        // Channel is already created in ClipByteApp.onCreate()
        startForeground(NOTIF_ID, buildNotification())
        startMonitoring()
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        mainScope.cancel()
    }

    // ── Clipboard polling ────────────────────────────────────────
    private fun startMonitoring() {
        // Must read clipboard on the MAIN thread on Android 10+
        mainScope.launch {
            val cm = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
            while (isActive) {
                if (FirebaseAuth.getInstance().currentUser != null) {
                    val text = try {
                        cm.primaryClip
                            ?.getItemAt(0)
                            ?.coerceToText(applicationContext)
                            ?.toString()
                            ?.trim()
                    } catch (e: Exception) { null }

                    if (!text.isNullOrEmpty()) {
                        val hash = text.hashCode()
                        if (hash != lastHash) {
                            lastHash = hash
                            serviceScope.launch {
                                runCatching { repository.addTextClip(text) }
                            }
                        }
                    }
                }
                delay(POLL_MS)
            }
        }
    }

    // ── Notification ─────────────────────────────────────────────
    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, ClipByteApp.CHANNEL_ID)
            .setContentTitle("ClipByte")
            .setContentText("Clipboard sync is active")
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .build()
}
