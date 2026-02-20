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
 * CloudinaryHelper Template
 * Copy this to CloudinaryHelper.kt and fill in your CLOUD_NAME and UPLOAD_PRESET.
 */
object CloudinaryHelper {

    private const val CLOUD_NAME    = "YOUR_CLOUD_NAME"
    private const val UPLOAD_PRESET = "YOUR_UNSIGNED_PRESET"
    private const val FOLDER        = "clipbyte"
    private const val TAG           = "CloudinaryHelper"
    private const val MAX_SIZE      = 5L * 1024 * 1024 // 5 MB

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun uploadImage(file: File): String = withContext(Dispatchers.IO) {
        val url = "https://api.cloudinary.com/v1_1/$CLOUD_NAME/image/upload"
        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("upload_preset", UPLOAD_PRESET)
            .addFormDataPart("folder",        FOLDER)
            .addFormDataPart("file", file.name, file.asRequestBody("image/*".toMediaTypeOrNull()))
            .build()
        val request = Request.Builder().url(url).post(requestBody).build()
        client.newCall(request).execute().use { response ->
            val body = response.body?.string() ?: throw RuntimeException("Empty response")
            if (!response.isSuccessful) throw RuntimeException("Upload failed: ${response.code}")
            JSONObject(body).getString("secure_url")
        }
    }
}
