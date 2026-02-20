package com.clipbyte.app.data.repository

import com.clipbyte.app.data.model.ClipItem
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

/**
 * ClipboardRepository
 * Single source of truth for all Firestore clipboard operations.
 * All writes set expiresAt = now + 1 hour.
 */
class ClipboardRepository @Inject constructor(
    private val db:   FirebaseFirestore,
    private val auth: FirebaseAuth
) {
    companion object {
        private const val ONE_HOUR_MS  = 60L * 60L * 1_000L
        private const val HISTORY_LIMIT = 10
        private const val DEVICE_LABEL  = "Android"
    }

    private val uid get() = auth.currentUser?.uid
        ?: throw IllegalStateException("User not authenticated")

    private fun clipsRef() = db.collection("users").document(uid).collection("clipboard")

    // ── Realtime Flow ────────────────────────────────────────────
    fun clipsFlow(): Flow<List<ClipItem>> = callbackFlow {
        val now = System.currentTimeMillis()
        val query = clipsRef()
            .whereGreaterThan("expiresAt", now)
            .orderBy("expiresAt", Query.Direction.DESCENDING)
            .limit(HISTORY_LIMIT.toLong())

        val listener = query.addSnapshotListener { snap, err ->
            if (err != null || snap == null) return@addSnapshotListener
            val items = snap.documents.mapNotNull { doc ->
                doc.toObject(ClipItem::class.java)?.copy(id = doc.id)
            }.filter { it.isValid() }
            trySend(items)
        }
        awaitClose { listener.remove() }
    }

    // ── Add clip ─────────────────────────────────────────────────
    suspend fun addTextClip(text: String) {
        val now = System.currentTimeMillis()
        clipsRef().add(
            ClipItem(
                type      = "text",
                content   = text,
                timestamp = now,
                expiresAt = now + ONE_HOUR_MS,
                device    = DEVICE_LABEL
            )
        ).await()
    }

    suspend fun addImageClip(imageUrl: String) {
        val now = System.currentTimeMillis()
        clipsRef().add(
            ClipItem(
                type      = "image",
                imageUrl  = imageUrl,
                timestamp = now,
                expiresAt = now + ONE_HOUR_MS,
                device    = DEVICE_LABEL
            )
        ).await()
    }

    // ── Delete single clip ───────────────────────────────────────
    suspend fun deleteClip(clipId: String) {
        clipsRef().document(clipId).delete().await()
    }

    // ── Delete expired clips (client-side cleanup on launch) ─────
    suspend fun cleanExpired() {
        val now  = System.currentTimeMillis()
        val snap = clipsRef()
            .whereLessThan("expiresAt", now)
            .limit(50)
            .get()
            .await()

        val batch = db.batch()
        snap.documents.forEach { batch.delete(it.reference) }
        if (snap.documents.isNotEmpty()) batch.commit().await()
    }
}
