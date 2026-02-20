package com.clipbyte.app.ui.clipboard

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.clipbyte.app.R
import com.clipbyte.app.data.model.ClipItem
import com.clipbyte.app.databinding.FragmentClipboardBinding
import kotlinx.coroutines.launch
import java.io.File

/**
 * ClipboardFragment — main clipboard UI.
 * Observes ClipboardViewModel for realtime updates.
 */
class ClipboardFragment : Fragment() {

    private var _binding: FragmentClipboardBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ClipboardViewModel by viewModels()

    private val pickImage = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? -> uri?.let { handlePickedUri(it) } }

    // ── Lifecycle ────────────────────────────────────────────────
    override fun onCreateView(i: LayoutInflater, c: ViewGroup?, s: Bundle?): View {
        _binding = FragmentClipboardBinding.inflate(i, c, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupClickListeners()
        observeState()
        observeEvents()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    // ── RecyclerView ─────────────────────────────────────────────
    private val adapter = ClipAdapter(
        onCopy   = { clip -> copyToSystem(clip) },
        onDelete = { clip -> viewModel.deleteClip(clip.id) }
    )

    private fun setupRecyclerView() {
        binding.rvClips.apply {
            this.adapter = this@ClipboardFragment.adapter
            layoutManager = LinearLayoutManager(requireContext())
        }
    }

    // ── Click listeners ──────────────────────────────────────────
    private fun setupClickListeners() {
        binding.btnSyncText.setOnClickListener {
            val text = binding.etTextInput.text.toString().trim()
            viewModel.syncText(text)
            binding.etTextInput.text?.clear()
        }
        binding.btnPickImage.setOnClickListener {
            pickImage.launch("image/*")
        }
    }

    // ── State observers ──────────────────────────────────────────
    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.clipsState.collect { state ->
                    when (state) {
                        is ClipsState.Loading -> {
                            binding.progressBar.visibility = View.VISIBLE
                            binding.rvClips.visibility     = View.GONE
                            binding.tvEmpty.visibility     = View.GONE
                        }
                        is ClipsState.Success -> {
                            binding.progressBar.visibility = View.GONE
                            if (state.items.isEmpty()) {
                                binding.rvClips.visibility = View.GONE
                                binding.tvEmpty.visibility = View.VISIBLE
                            } else {
                                binding.rvClips.visibility = View.VISIBLE
                                binding.tvEmpty.visibility = View.GONE
                                adapter.submitList(state.items)
                            }
                        }
                        is ClipsState.Error -> {
                            binding.progressBar.visibility = View.GONE
                            showToast(state.message)
                        }
                    }
                }
            }
        }
    }

    private fun observeEvents() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiEvent.collect { event ->
                    when (event) {
                        is UiEvent.ShowToast     -> showToast(event.message)
                        is UiEvent.ShowUploading -> binding.uploadProgress.visibility =
                            if (event.show) View.VISIBLE else View.GONE
                    }
                }
            }
        }
    }

    // ── Helpers ──────────────────────────────────────────────────
    private fun handlePickedUri(uri: Uri) {
        val file = uriToTempFile(uri) ?: return
        viewModel.uploadImage(file)
    }

    private fun uriToTempFile(uri: Uri): File? = runCatching {
        val stream = requireContext().contentResolver.openInputStream(uri) ?: return null
        val tmp    = File(requireContext().cacheDir, "upload_${System.currentTimeMillis()}.jpg")
        tmp.outputStream().use { stream.copyTo(it) }
        tmp
    }.getOrNull()

    private fun copyToSystem(clip: ClipItem) {
        val cm = requireContext().getSystemService(android.content.ClipboardManager::class.java)
        val label = "ClipByte"
        val content = if (clip.type == "image") clip.imageUrl else clip.content
        cm.setPrimaryClip(android.content.ClipData.newPlainText(label, content))
        showToast("Copied ✓")
    }

    private fun showToast(msg: String) {
        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
    }
}

// ── Adapter ───────────────────────────────────────────────────
private class ClipAdapter(
    private val onCopy:   (ClipItem) -> Unit,
    private val onDelete: (ClipItem) -> Unit
) : ListAdapter<ClipItem, ClipAdapter.VH>(DIFF) {

    inner class VH(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvDevice:  TextView  = itemView.findViewById(R.id.tv_device)
        val tvTime:    TextView  = itemView.findViewById(R.id.tv_time)
        val tvContent: TextView  = itemView.findViewById(R.id.tv_content)
        val ivImage:   ImageView = itemView.findViewById(R.id.iv_image)
        val btnCopy:   View      = itemView.findViewById(R.id.btn_copy)
        val btnDelete: View      = itemView.findViewById(R.id.btn_delete)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val layout = if (viewType == 0) R.layout.item_clip_text else R.layout.item_clip_image
        val v = LayoutInflater.from(parent.context).inflate(layout, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val clip = getItem(position)
        holder.tvDevice.text = clip.device
        holder.tvTime.text   = timeAgo(clip.timestamp)
        if (clip.type == "text") {
            holder.tvContent.text = clip.content
        } else {
            holder.ivImage.load(clip.imageUrl) { crossfade(true) }
        }
        holder.btnCopy.setOnClickListener   { onCopy(clip) }
        holder.btnDelete.setOnClickListener { onDelete(clip) }
    }

    override fun getItemViewType(position: Int) = if (getItem(position).type == "text") 0 else 1

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<ClipItem>() {
            override fun areItemsTheSame(o: ClipItem, n: ClipItem)    = o.id == n.id
            override fun areContentsTheSame(o: ClipItem, n: ClipItem) = o == n
        }
    }
}

private fun timeAgo(ms: Long): String {
    val diff = System.currentTimeMillis() - ms
    return when {
        diff < 60_000L      -> "just now"
        diff < 3_600_000L   -> "${diff / 60_000}m ago"
        else                -> "${diff / 3_600_000}h ago"
    }
}
