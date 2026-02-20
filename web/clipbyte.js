// ── Port Check (CRITICAL) ─────────────────────────────────────
if (window.location.port === "5500") {
    alert("CRITICAL: You are on port 5500 (Live Server).\n\nPlease use http://localhost:3000 to avoid caching and UI bugs!");
    window.location.href = "http://localhost:3000";
}

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
    getDocs,
    serverTimestamp,
    Timestamp,
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// ── DOM refs ──────────────────────────────────────────────────
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const logoutBtn = document.getElementById("logout-btn");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const userEmail = document.getElementById("user-email");
const textInput = document.getElementById("text-input");
const syncTextBtn = document.getElementById("sync-text-btn");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const uploadProgress = document.getElementById("upload-progress");
const progressBar = document.getElementById("progress-bar");
const historyList = document.getElementById("history-list");
const emptyState = document.getElementById("empty-state");
const toastEl = document.getElementById("toast");
const authError = document.getElementById("auth-error");


let currentUser = null;
let unsubscribeSnap = null;
const ONE_HOUR_MS = 60 * 60 * 1000;
const HISTORY_LIMIT = 10;
const DEVICE_LABEL = "Web";



// ── Auth tabs ─────────────────────────────────────────────────
// Registration tab and logic removed. Only login remains.

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

logoutBtn.addEventListener("click", async () => {
    if (unsubscribeSnap) unsubscribeSnap();
    await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        authSection.classList.add("hidden");
        appSection.classList.remove("hidden");
        logoutBtn.classList.remove("hidden");
        userEmail.textContent = user.email;
        startRealtimeSync(user.uid);
        deleteExpiredClips(user.uid);
    } else {
        authSection.classList.remove("hidden");
        appSection.classList.add("hidden");
        logoutBtn.classList.add("hidden");
        historyList.innerHTML = "";
        if (unsubscribeSnap) unsubscribeSnap();
    }
});

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
        renderHistory(snapshot.docs.map((d) => ({ ...d.data(), id: d.id })));
    });
}

async function deleteExpiredClips(uid) {
    console.log(`[ClipByte] Checking for expired clips manually for user: ${uid}...`);
    try {
        const clipsRef = collection(db, "users", uid, "clipboard");
        const q = query(
            clipsRef,
            where("expiresAt", "<", Date.now())
        );
        const snap = await getDocs(q);
        if (snap.empty) {
            console.log("[ClipByte] No expired clips found.");
            return;
        }

        console.log(`[ClipByte] Found ${snap.size} expired clips. Deleting...`);
        const batchPromises = snap.docs.map((d) => {
            console.log(` - Deleting clip ${d.id} (expired at ${new Date(d.data().expiresAt).toLocaleString()})`);
            return deleteDoc(doc(db, "users", uid, "clipboard", d.id));
        });
        await Promise.all(batchPromises);
        console.log("[ClipByte] Cleanup complete.");
    } catch (err) {
        console.error("[ClipByte] Manual cleanup failed:", err);
    }
}

// ── Render History (v2.1 Bulletproof) ────────────────────────
function renderHistory(clips) {
    historyList.innerHTML = "";
    const valid = clips.filter((c) => c.expiresAt > Date.now());

    if (valid.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }
    console.log(`[ClipByte] Rendering ${valid.length} valid clips...`);
    emptyState.classList.add("hidden");

    let finalHtml = "";

    valid.forEach((clip) => {
        const type = String(clip.type || "").toLowerCase();
        const timeStr = timeAgo(clip.timestamp);
        const ttlLabel = msToCountdown(clip.expiresAt - Date.now());

        const isText = type === "text";
        const contentHtml = isText
            ? `<p class="clip-text">${escapeHtml(clip.content)}</p>`
            : `<img src="${escapeHtml(clip.imageUrl)}" alt="Clipboard image" class="clip-image" loading="lazy">`;

        // Build action buttons as strings for absolute reliability
        let actionButtonsHtml = "";
        if (isText) {
            actionButtonsHtml = `
              <button class="btn btn-sm btn-action" style="cursor: pointer !important; pointer-events: auto !important; z-index: 10;" onclick="window.copyText(\`${clip.content.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`)">📋 Copy</button>
              <button class="btn btn-sm btn-danger btn-action" style="cursor: pointer !important; pointer-events: auto !important; z-index: 10;" onclick="if(confirm('Delete this clip?')){ window.deleteClip('${clip.id}') }">🗑 Delete</button>
            `;
        } else {
            actionButtonsHtml = `
              <button class="btn btn-sm btn-action" style="cursor: pointer !important; pointer-events: auto !important; z-index: 10;" onclick="window.downloadImage(\`${clip.imageUrl}\`)">⬇ Download</button>
              <button class="btn btn-sm btn-action" style="cursor: pointer !important; pointer-events: auto !important; z-index: 10;" onclick="window.copyText(\`${clip.imageUrl}\`)">📋 Copy URL</button>
              <button class="btn btn-sm btn-danger btn-action" style="cursor: pointer !important; pointer-events: auto !important; z-index: 10;" onclick="if(confirm('Delete this clip?')){ window.deleteClip('${clip.id}') }">🗑 Delete</button>
            `;
        }

        finalHtml += `
          <li class="clip-card clip-${type}" data-id="${clip.id}">
            <div class="clip-meta">
              <span class="clip-device">${clip.device || "Unknown"}</span>
              <span class="clip-time">${timeStr}</span>
              <span class="clip-ttl" data-expires="${clip.expiresAt}">⏱ expires in ${ttlLabel}</span>
            </div>
            <div class="clip-body">
              ${contentHtml}
            </div>
            <div class="clip-actions" style="display: flex !important; gap: 8px !important; margin-top: auto !important; padding-top: 12px !important; border-top: 1px solid rgba(255,255,255,0.1) !important; min-height: 48px !important;">
              ${actionButtonsHtml}
            </div>
          </li>
        `;
    });

    historyList.innerHTML = finalHtml;

    historyList.scrollTop = 0;
}

console.log("[ClipByte] Core JS Loaded - v2.9 (Single Sign-On)");

window.deleteClip = async function (clipId) {
    if (!currentUser) {
        alert("Please sign in again.");
        return;
    }
    if (!clipId || typeof clipId !== 'string' || clipId.trim() === "") {
        console.error("[ClipByte] Invalid clipId:", clipId);
        alert("Error: Missing Clip ID. Try refreshing the page.");
        return;
    }
    try {
        console.log(`[ClipByte] Nuclear Delete: ${clipId}`);
        // Ensure path is exactly users/uid/clipboard/clipId
        const clipRef = doc(db, "users", currentUser.uid, "clipboard", clipId);

        await deleteDoc(clipRef);
        console.log("[ClipByte] Delete command sent to Firebase.");
        showToast("Deleted ✓");

        // Force UI update
        const el = document.querySelector(`[data-id="${clipId}"]`);
        if (el) el.remove();

    } catch (err) {
        console.error("[ClipByte] Delete ERROR:", err);
        alert("Delete failed! Check your internet or Firebase permissions.\n\nError: " + err.message);
    }
};

// ── Clipboard helpers ─────────────────────────────────────────
window.copyText = async function (text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard ✓");
    } catch {
        showToast("Copy failed", true);
    }
};

window.downloadImage = async function (url) {
    try {
        showToast("Starting download…");
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `clipbyte_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            a.remove();
        }, 100);
        showToast("Download started ✓");
    } catch (err) {
        console.error("Download failed:", err);
        showToast("Download failed", true);
        window.open(url, "_blank");
    }
};

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

// ── Periodic cleanup (runs every 5 minutes) ───────────────────
setInterval(() => {
    if (currentUser) deleteExpiredClips(currentUser.uid);
}, 5 * 60 * 1000);

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
