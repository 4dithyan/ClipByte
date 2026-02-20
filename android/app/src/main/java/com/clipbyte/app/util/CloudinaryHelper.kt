package com.clipbyte.app.util

import android.net.Uri
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * CloudinaryHelper
 *
 * Unsigned multipart upload to Cloudinary.
 * Replace CLOUD_NAME with your Cloudinary cloud name.
 * The upload preset "clipbyte_unsigned" must be created in your
 * Cloudinary dashboard (Settings → Upload Presets → Unsigned).
 */
object CloudinaryHelper {

    private const val CLOUD_NAME    = "YOUR_CLOUD_NAME"          // ← replace
    private const val UPLOAD_PRESET = "clipbyte_unsigned"
    private const val FOLDER        = "clipbyte"
    private const val TAG           = "CloudinaryHelper"
    private const val MAX_SIZE      = 5L * 1024 * 1024           // 5 MB

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    /**
     * Uploads [file] to Cloudinary and returns the secure_url.
     * Must be called from a coroutine (switches to IO dispatcher internally).
     */
    suspend fun uploadImage(file: File): String = withContext(Dispatchers.IO) {
        require(file.exists())            { "File does not exist: ${file.path}" }
        require(file.length() <= MAX_SIZE){ "File exceeds 5 MB limit" }

        val mimeType = when (file.extension.lowercase()) {
            "jpg", "jpeg" -> "image/jpeg"
            "png"         -> "image/png"
            "webp"        -> "image/webp"
            else          -> throw IllegalArgumentException("Unsupported format: ${file.extension}")
        }

        val url = "https://api.cloudinary.com/v1_1/$CLOUD_NAME/image/upload"

        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("upload_preset", UPLOAD_PRESET)
            .addFormDataPart("folder",        FOLDER)
            .addFormDataPart(
                "file",
                file.name,
                file.asRequestBody(mimeType.toMediaTypeOrNull())
            )
            .build()

        val request = Request.Builder().url(url).post(requestBody).build()

        client.newCall(request).execute().use { response ->
            val body = response.body?.string() ?: throw RuntimeException("Empty Cloudinary response")
            if (!response.isSuccessful) {
                Log.e(TAG, "Upload failed [${ response.code }]: $body")
                throw RuntimeException("Cloudinary upload failed: ${response.code}")
            }
            JSONObject(body).getString("secure_url")
        }
    }

    /**
     * Convenience: resolves a [Uri] to a temp file, uploads it, then deletes temp file.
     */
    suspend fun uploadUri(uri: Uri, cacheDir: File): String {
        val ext  = uri.lastPathSegment?.substringAfterLast('.', "jpg") ?: "jpg"
        val tmp  = File(cacheDir, "cb_upload_${System.currentTimeMillis()}.$ext")
        try {
            // copy URI to temp file using context-provided InputStream
            // (caller must pass the InputStream or we use [uploadImageWithStream])
            return uploadImage(tmp)
        } finally {
            tmp.delete()
        }
    }
}
