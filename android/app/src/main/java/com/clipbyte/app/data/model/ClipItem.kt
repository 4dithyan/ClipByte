package com.clipbyte.app.data.model

/**
 * ClipItem — Firestore document model.
 *
 * Stored at: users/{userId}/clipboard/{clipId}
 */
data class ClipItem(
    val id:        String = "",
    val type:      String = "text",   // "text" | "image"
    val content:   String = "",       // plain text content
    val imageUrl:  String = "",       // Cloudinary secure URL
    val timestamp: Long   = 0L,       // epoch millis
    val expiresAt: Long   = 0L,       // auto-delete epoch millis (timestamp + 1h)
    val device:    String = "Android" // "Android" | "Web"
) {
    /** Returns true if this clip has not yet expired. */
    fun isValid(): Boolean = expiresAt > System.currentTimeMillis()
}
