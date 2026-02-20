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

        setupTabs()
        setupClickListeners()
    }

    // ── Tabs ─────────────────────────────────────────────────────
    private fun setupTabs() {
        binding.tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                when (tab?.position) {
                    0 -> showTab(isLogin = true)
                    1 -> showTab(isLogin = false)
                }
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }

    private fun showTab(isLogin: Boolean) {
        binding.layoutLogin.visibility    = if (isLogin) View.VISIBLE else View.GONE
        binding.layoutRegister.visibility = if (isLogin) View.GONE   else View.VISIBLE
        binding.tvAuthError.visibility    = View.GONE
    }

    // ── Click listeners ──────────────────────────────────────────
    private fun setupClickListeners() {
        binding.btnLogin.setOnClickListener    { doLogin() }
        binding.btnRegister.setOnClickListener { doRegister() }
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

    private fun doRegister() {
        val email = binding.etRegEmail.text.toString().trim()
        val pass  = binding.etRegPassword.text.toString()
        if (email.isEmpty() || pass.isEmpty()) {
            showError("Please enter email and password.")
            return
        }
        if (pass.length < 6) {
            showError("Password must be at least 6 characters.")
            return
        }
        setLoading(true)
        auth.createUserWithEmailAndPassword(email, pass)
            .addOnSuccessListener { goToMain() }
            .addOnFailureListener { e ->
                setLoading(false)
                showError(e.message ?: "Registration failed.")
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
        binding.btnRegister.isEnabled  = !show
    }

    private fun showError(msg: String) {
        binding.tvAuthError.text       = msg
        binding.tvAuthError.visibility = View.VISIBLE
    }
}
