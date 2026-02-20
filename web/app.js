// ============================================================
//  app.js  —  ClipByte Web Application
//  Handles: Auth, Firestore realtime sync, text/image clipboard,
//           drag-drop, history, dark-mode, auto-delete TTL
// ============================================================

import { auth, db } from "./firebase-config.js";
import { uploadToCloudinary } from "./cloudinary.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    deleteDoc,
    doc,
    serverTimestamp,
    Timestamp,
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// ── DOM refs ──────────────────────────────────────────────────
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const regEmail = document.getElementById("reg-email");
const regPassword = document.getElementById("reg-password");
const regBtn = document.getElementById("reg-btn");
const logoutBtn = document.getElementById("logout-btn");
const userEmail = document.getElementById("user-email");
const textInput = document.getElementById("text-input");
const syncTextBtn = document.getElementById("sync-text-btn");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const uploadProgress = document.getElementById("upload-progress");
const progressBar = document.getElementById("progress-bar");
const historyList = document.getElementById("history-list");
const emptyState = document.getElementById("empty-state");
const themeToggle = document.getElementById("theme-toggle");
const toastEl = document.getElementById("toast");
const authError = document.getElementById("auth-error");

// ── State ─────────────────────────────────────────────────────
let currentUser = null;
let unsubscribeSnap = null;       // Firestore listener teardown
const ONE_HOUR_MS = 60 * 60 * 1000;
const HISTORY_LIMIT = 10;
const DEVICE_LABEL = "Web";

// ── Theme ─────────────────────────────────────────────────────
const savedTheme = localStorage.getItem("clipbyte-theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);
updateThemeIcon(savedTheme);

themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("clipbyte-theme", next);
    updateThemeIcon(next);
});

function updateThemeIcon(theme) {
    themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
}

// ── Auth tabs ─────────────────────────────────────────────────
tabLogin.addEventListener("click", () => switchTab("login"));
tabRegister.addEventListener("click", () => switchTab("register"));

function switchTab(tab) {
    if (tab === "login") {
        loginForm.classList.add("active");
        registerForm.classList.remove("active");
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
    } else {
        registerForm.classList.add("active");
        loginForm.classList.remove("active");
        tabRegister.classList.add("active");
        tabLogin.classList.remove("active");
    }
    clearAuthError();
}

// ── Firebase Auth ─────────────────────────────────────────────
loginBtn.addEventListener("click", async () => {
    const email = loginEmail.value.trim();
    const pass = loginPassword.value;
    if (!email || !pass) return showAuthError("Please fill in all fields.");
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in…";
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
        showAuthError(friendlyAuthError(e.code));
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign In";
    }
});

regBtn.addEventListener("click", async () => {
    const email = regEmail.value.trim();
    const pass = regPassword.value;
    if (!email || !pass) return showAuthError("Please fill in all fields.");
    if (pass.length < 6) return showAuthError("Password must be at least 6 characters.");
    regBtn.disabled = true;
    regBtn.textContent = "Creating account…";
    try {
        await createUserWithEmailAndPassword(auth, email, pass);
    } catch (e) {
        showAuthError(friendlyAuthError(e.code));
    } finally {
        regBtn.disabled = false;
        regBtn.textContent = "Create Account";
    }
});

logoutBtn.addEventListener("click", async () => {
    if (unsubscribeSnap) unsubscribeSnap();
    await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        authSection.classList.add("hidden");
        appSection.classList.remove("hidden");
        userEmail.textContent = user.email;
        startRealtimeSync(user.uid);
        deleteExpiredClips(user.uid);
    } else {
        authSection.classList.remove("hidden");
        appSection.classList.add("hidden");
        historyList.innerHTML = "";
        if (unsubscribeSnap) unsubscribeSnap();
    }
});

// ── Text Sync ─────────────────────────────────────────────────
syncTextBtn.addEventListener("click", async () => {
    const text = textInput.value.trim();
    if (!text || !currentUser) return;
    await addClip({ type: "text", content: text });
    textInput.value = "";
    showToast("Text synced ✓");
});

// Keyboard shortcut: Ctrl+Enter to sync text
textInput.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") syncTextBtn.click();
});

// Global paste listener (intercept Ctrl+V anywhere on the page)
document.addEventListener("paste", async (e) => {
    if (!currentUser) return;
    // Text paste when NOT focused on textarea
    if (document.activeElement !== textInput) {
        const text = e.clipboardData.getData("text/plain");
        if (text) {
            await addClip({ type: "text", content: text });
            showToast("Text pasted & synced ✓");
            return;
        }
    }
    // Image paste
    const file = getImageFromClipboard(e.clipboardData);
    if (file) {
        e.preventDefault();
        await handleImageUpload(file);
    }
});

// ── Image Drag-Drop ───────────────────────────────────────────
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) await handleImageUpload(file);
});
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (file) await handleImageUpload(file);
    fileInput.value = "";
});

function getImageFromClipboard(clipboardData) {
    for (const item of clipboardData.items) {
        if (item.type.startsWith("image/")) return item.getAsFile();
    }
    return null;
}

async function handleImageUpload(file) {
    if (!currentUser) return;
    try {
        uploadProgress.classList.remove("hidden");
        const imageUrl = await uploadToCloudinary(file, (pct) => {
            progressBar.style.width = `${pct}%`;
        });
        uploadProgress.classList.add("hidden");
        progressBar.style.width = "0%";
        await addClip({ type: "image", content: "", imageUrl });
        showToast("Image synced ✓");
    } catch (err) {
        uploadProgress.classList.add("hidden");
        progressBar.style.width = "0%";
        showToast(`Upload failed: ${err.message}`, true);
    }
}

// ── Firestore Helpers ─────────────────────────────────────────
async function addClip({ type, content = "", imageUrl = "" }) {
    if (!currentUser) return;
    const now = Date.now();
    await addDoc(collection(db, "users", currentUser.uid, "clipboard"), {
        type,
        content,
        imageUrl,
        timestamp: now,
        expiresAt: now + ONE_HOUR_MS,
        device: DEVICE_LABEL,
    });
}

function startRealtimeSync(uid) {
    const clipsRef = collection(db, "users", uid, "clipboard");
    const q = query(
        clipsRef,
        where("expiresAt", ">", Date.now()),
        orderBy("expiresAt", "desc"),
        limit(HISTORY_LIMIT)
    );

    unsubscribeSnap = onSnapshot(q, (snapshot) => {
        renderHistory(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
}

async function deleteExpiredClips(uid) {
    // Soft cleanup on page load: delete docs where expiresAt < now
    // A Cloud Function handles server-side cleanup if configured
    const clipsRef = collection(db, "users", uid, "clipboard");
    const q = query(
        clipsRef,
        where("expiresAt", "<", Date.now()),
        limit(50)
    );
    const snap = await import(
        "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js"
    ).then(({ getDocs }) => getDocs(q));
    snap.forEach((d) => deleteDoc(doc(db, "users", uid, "clipboard", d.id)));
}

// ── Render History ────────────────────────────────────────────
function renderHistory(clips) {
    historyList.innerHTML = "";
    const valid = clips.filter((c) => c.expiresAt > Date.now());

    if (valid.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }
    emptyState.classList.add("hidden");

    valid.forEach((clip) => {
        const card = document.createElement("div");
        card.className = `clip-card clip-${clip.type}`;
        card.dataset.id = clip.id;

        const meta = document.createElement("div");
        meta.className = "clip-meta";
        meta.innerHTML = `
      <span class="clip-device">${clip.device || "Unknown"}</span>
      <span class="clip-time">${timeAgo(clip.timestamp)}</span>
      <span class="clip-ttl" data-expires="${clip.expiresAt}">⏱ expires in ${msToCountdown(clip.expiresAt - Date.now())}</span>
    `;

        const body = document.createElement("div");
        body.className = "clip-body";

        if (clip.type === "text") {
            body.innerHTML = `<p class="clip-text">${escapeHtml(clip.content)}</p>`;
            const actions = createActions([
                { label: "📋 Copy", handler: () => copyText(clip.content) },
                { label: "🗑 Delete", handler: () => deleteClip(clip.id), cls: "btn-danger" },
            ]);
            card.append(meta, body, actions);
        } else {
            body.innerHTML = `<img src="${escapeHtml(clip.imageUrl)}" alt="Clipboard image" class="clip-image" loading="lazy">`;
            const actions = createActions([
                { label: "⬇ Download", handler: () => downloadImage(clip.imageUrl) },
                { label: "📋 Copy URL", handler: () => copyText(clip.imageUrl) },
                { label: "🗑 Delete", handler: () => deleteClip(clip.id), cls: "btn-danger" },
            ]);
            card.append(meta, body, actions);
        }

        historyList.appendChild(card);
    });
}

function createActions(buttons) {
    const row = document.createElement("div");
    row.className = "clip-actions";
    buttons.forEach(({ label, handler, cls = "" }) => {
        const btn = document.createElement("button");
        btn.className = `btn btn-sm ${cls}`;
        btn.textContent = label;
        btn.addEventListener("click", handler);
        row.appendChild(btn);
    });
    return row;
}

async function deleteClip(clipId) {
    if (!currentUser) return;
    await deleteDoc(doc(db, "users", currentUser.uid, "clipboard", clipId));
    showToast("Deleted ✓");
}

// ── Clipboard helpers ─────────────────────────────────────────
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard ✓");
    } catch {
        showToast("Copy failed", true);
    }
}

async function downloadImage(url) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `clipbyte_${Date.now()}.jpg`;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// ── UI Utilities ──────────────────────────────────────────────
function showToast(msg, error = false) {
    toastEl.textContent = msg;
    toastEl.className = `toast show${error ? " error" : ""}`;
    setTimeout(() => toastEl.classList.remove("show"), 3000);
}

function showAuthError(msg) {
    authError.textContent = msg;
    authError.classList.remove("hidden");
}

function clearAuthError() {
    authError.textContent = "";
    authError.classList.add("hidden");
}

function escapeHtml(str = "") {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function timeAgo(ms) {
    const diff = Date.now() - ms;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return `${Math.floor(diff / 3_600_000)}h ago`;
}

function msToCountdown(ms) {
    if (ms <= 0) return "expired";
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function friendlyAuthError(code) {
    const map = {
        "auth/invalid-email": "Invalid email address.",
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/email-already-in-use": "Email already registered.",
        "auth/weak-password": "Password is too weak (min 6 chars).",
        "auth/too-many-requests": "Too many attempts. Try again later.",
        "auth/network-request-failed": "Network error. Check your connection.",
        "auth/invalid-credential": "Invalid credentials. Please try again.",
    };
    return map[code] || "Authentication failed. Please try again.";
}

// ── Countdown ticker (updates TTL display every second) ───────
setInterval(() => {
    document.querySelectorAll(".clip-ttl").forEach((el) => {
        const expires = Number(el.dataset.expires);
        const remaining = expires - Date.now();
        if (remaining <= 0) {
            // Remove the card — Firestore listener will also clean it
            const card = el.closest(".clip-card");
            if (card) card.remove();
            const visible = document.querySelectorAll(".clip-card").length;
            if (visible === 0) emptyState.classList.remove("hidden");
        } else {
            el.textContent = `⏱ expires in ${msToCountdown(remaining)}`;
        }
    });
}, 1000);
