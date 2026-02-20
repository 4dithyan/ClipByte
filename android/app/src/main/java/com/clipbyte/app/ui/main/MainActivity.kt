package com.clipbyte.app.ui.main

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.clipbyte.app.databinding.ActivityMainBinding
import com.clipbyte.app.service.ClipboardMonitorService
import com.clipbyte.app.ui.auth.LoginActivity
import com.clipbyte.app.ui.clipboard.ClipboardFragment
import com.google.firebase.auth.FirebaseAuth

/**
 * MainActivity — hosts ClipboardFragment and manages
 * lifecycle of ClipboardMonitorService.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val auth by lazy { FirebaseAuth.getInstance() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.tvUserEmail.text = auth.currentUser?.email ?: ""

        binding.btnLogout.setOnClickListener {
            stopService(Intent(this, ClipboardMonitorService::class.java))
            auth.signOut()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(binding.fragmentContainer.id, ClipboardFragment())
                .commit()
        }
    }

    override fun onStart() {
        super.onStart()
        // Start foreground clipboard monitor
        val intent = Intent(this, ClipboardMonitorService::class.java)
        startService(intent)
    }

    override fun onStop() {
        super.onStop()
        // Keep service running so clipboard is monitored in background
    }
}
