package com.clipbyte.app.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.clipbyte.app.databinding.ActivityLoginBinding
import com.clipbyte.app.ui.main.MainActivity
import com.google.android.material.tabs.TabLayout
import com.google.firebase.auth.FirebaseAuth

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private val auth by lazy { FirebaseAuth.getInstance() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Already logged in — skip to main
        if (auth.currentUser != null) { goToMain(); return }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupClickListeners()
    }


    // ── Click listeners ──────────────────────────────────────────
    private fun setupClickListeners() {
        binding.btnLogin.setOnClickListener { doLogin() }
    }

    // ── Auth actions ─────────────────────────────────────────────
    private fun doLogin() {
        val email = binding.etLoginEmail.text.toString().trim()
        val pass  = binding.etLoginPassword.text.toString()
        if (email.isEmpty() || pass.isEmpty()) {
            showError("Please enter email and password.")
            return
        }
        setLoading(true)
        auth.signInWithEmailAndPassword(email, pass)
            .addOnSuccessListener { goToMain() }
            .addOnFailureListener { e ->
                setLoading(false)
                showError(e.message ?: "Login failed.")
            }
    }


    // ── Helpers ──────────────────────────────────────────────────
    private fun goToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }

    private fun setLoading(show: Boolean) {
        binding.progressBar.visibility = if (show) View.VISIBLE else View.GONE
        binding.btnLogin.isEnabled     = !show
    }

    private fun showError(msg: String) {
        binding.tvAuthError.text       = msg
        binding.tvAuthError.visibility = View.VISIBLE
    }
}
