package com.clipbyte.app.ui.clipboard

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clipbyte.app.data.model.ClipItem
import com.clipbyte.app.data.repository.ClipboardRepository
import com.clipbyte.app.util.CloudinaryHelper
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.io.File

/**
 * ClipboardViewModel
 * MVVM ViewModel for the clipboard dashboard.
 * Exposes:
 *  - clipsState: real-time list of ClipItems
 *  - uiEvent: one-shot UI events (toast messages, navigation)
 */
class ClipboardViewModel : ViewModel() {

    private val repository = ClipboardRepository(
        db   = FirebaseFirestore.getInstance(),
        auth = FirebaseAuth.getInstance()
    )

    // ── State ─────────────────────────────────────────────────────
    private val _clipsState = MutableStateFlow<ClipsState>(ClipsState.Loading)
    val clipsState: StateFlow<ClipsState> = _clipsState.asStateFlow()

    private val _uiEvent = MutableSharedFlow<UiEvent>(extraBufferCapacity = 4)
    val uiEvent: SharedFlow<UiEvent> = _uiEvent.asSharedFlow()

    /** Hash of last uploaded text — prevents duplicate writes */
    private var lastTextHash: Int = -1

    // ── Init ──────────────────────────────────────────────────────
    init {
        viewModelScope.launch { repository.cleanExpired() }
        collectClips()
    }

    private fun collectClips() = viewModelScope.launch {
        repository.clipsFlow()
            .catch { e -> _clipsState.value = ClipsState.Error(e.message ?: "Unknown error") }
            .collect { items ->
                _clipsState.value = ClipsState.Success(items)
            }
    }

    // ── Actions ────────────────────────────────────────────────────
    fun syncText(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        val hash = trimmed.hashCode()
        if (hash == lastTextHash) return   // deduplicate
        lastTextHash = hash

        viewModelScope.launch {
            runCatching {
                repository.addTextClip(trimmed)
                _uiEvent.emit(UiEvent.ShowToast("Text synced ✓"))
            }.onFailure { e ->
                _uiEvent.emit(UiEvent.ShowToast("Sync failed: ${e.message}"))
            }
        }
    }

    fun uploadImage(file: File) {
        viewModelScope.launch {
            _uiEvent.emit(UiEvent.ShowUploading(true))
            runCatching {
                val url = CloudinaryHelper.uploadImage(file)
                repository.addImageClip(url)
                _uiEvent.emit(UiEvent.ShowToast("Image synced ✓"))
            }.onFailure { e ->
                _uiEvent.emit(UiEvent.ShowToast("Upload failed: ${e.message}"))
            }
            _uiEvent.emit(UiEvent.ShowUploading(false))
        }
    }

    fun deleteClip(clipId: String) = viewModelScope.launch {
        runCatching { repository.deleteClip(clipId) }
            .onSuccess { _uiEvent.emit(UiEvent.ShowToast("Deleted")) }
            .onFailure { _uiEvent.emit(UiEvent.ShowToast("Delete failed")) }
    }
}

// ── Sealed classes ─────────────────────────────────────────────
sealed class ClipsState {
    object Loading                           : ClipsState()
    data class Success(val items: List<ClipItem>) : ClipsState()
    data class Error(val message: String)    : ClipsState()
}

sealed class UiEvent {
    data class ShowToast(val message: String) : UiEvent()
    data class ShowUploading(val show: Boolean) : UiEvent()
}
