# ⚡ ClipByte

A **cross-device clipboard sync app** — copy on Android, paste on the web (and vice versa) in real-time.

![ClipByte Banner](https://img.shields.io/badge/ClipByte-Clipboard%20Sync-6C63FF?style=for-the-badge&logo=firebase)
![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Web-0D0D1A?style=for-the-badge)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?style=for-the-badge&logo=firebase)

---

## ✨ Features

- 🔄 **Real-time sync** — text appears on all devices instantly
- 📋 **Auto clipboard monitor** — Android detects clipboard changes automatically
- 🖼 **Image sync** — upload images via Cloudinary (optional)
- ⏱ **1-hour auto-delete** — clips expire automatically
- 🔐 **Secure** — every user sees only their own data
- 🌙 **Dark mode** — web app supports dark/light themes

---

## 🗂 Project Structure

```
ClipByte/
├── .gitignore
├── firebase.json               ← Firebase Hosting config
├── firestore.rules             ← Firestore security rules
├── functions/
│   └── index.js                ← Optional: scheduled cleanup (Blaze plan)
├── web/
│   ├── index.html              ← Web app UI
│   ├── styles.css              ← Dark/light theme styles
│   ├── app.js                  ← Firebase Auth + Firestore sync logic
│   ├── cloudinary.js           ← Image upload helper (optional)
│   └── firebase-config.js      ← 🔑 YOU CREATE THIS (see setup below)
└── android/
    ├── build.gradle
    ├── settings.gradle
    ├── gradle.properties
    └── app/
        ├── build.gradle
        ├── google-services.json         ← 🔑 YOU DOWNLOAD THIS (see setup below)
        ├── google-services.json.template ← example of what it looks like
        └── src/main/java/com/clipbyte/app/
```

---

## 🚀 Setup Guide

### Step 1 — Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `clipbyte`) → Continue
3. Enable **Google Analytics** (optional) → Create project

---

### Step 2 — Enable Firebase Services

#### Authentication
1. Firebase Console → **Authentication** → Get started
2. **Sign-in method** tab → **Email/Password** → Enable → Save

#### Firestore Database
1. Firebase Console → **Firestore Database** → Create database
2. Choose **Start in production mode** → Next → Select region → Done

---

### Step 3 — Deploy Firestore Security Rules

1. Firebase Console → **Firestore Database** → **Rules** tab
2. Replace everything with the contents of [`firestore.rules`](./firestore.rules)
3. Click **Publish**

---

### Step 4 — Set Up the Web App

#### 4a. Register a Web App in Firebase
1. Firebase Console → Project Settings (⚙️) → **Your apps** → Add app → Web (`</>`)
2. Register the app → copy the `firebaseConfig` object

#### 4b. Create `web/firebase-config.js`
Create the file `web/firebase-config.js` (this file is git-ignored — never commit it):

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",           // ← paste from Firebase Console
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

try { enableIndexedDbPersistence(db); } catch (e) { console.warn(e.code); }

export { auth, db };
```

#### 4c. Run the Web App Locally
```bash
# Option A — using Node.js serve
cd ClipByte
npx serve web

# Option B — deploy to Firebase Hosting (recommended)
npm install -g firebase-tools
firebase login
firebase init hosting
# → Public directory: web
# → Single-page app: Yes
# → Overwrite index.html: No
firebase deploy --only hosting
```

After deploying, add your `.web.app` URL to:  
**Firebase Console → Authentication → Authorized Domains → Add domain**

---

### Step 5 — Set Up the Android App

#### 5a. Register an Android App in Firebase
1. Firebase Console → Project Settings → **Your apps** → Add app → Android
2. Package name: `com.clipbyte.app`
3. Click **Register app**
4. Download **`google-services.json`**
5. Place it at: `android/app/google-services.json` (this file is git-ignored)

#### 5b. Open in Android Studio
1. Open **Android Studio**
2. **File → Open** → select the `android/` folder
3. Wait for **Gradle sync** to complete (downloads all dependencies automatically)
4. Connect your Android device (USB debugging on) or start an emulator
5. Click **Run ▶️**

> ⚠️ Requires Android 8.0 (API 26) or higher.

---

### Step 6 — Optional: Image Sync via Cloudinary

By default, image sync is disabled. To enable it:

1. Create a free account at [cloudinary.com](https://cloudinary.com)
2. **Settings → Upload → Upload Presets → Add preset**
   - Name: `clipbyte_unsigned`
   - Signing Mode: **Unsigned**
   - Allowed formats: `jpg, jpeg, png, webp`
3. Copy your **Cloud Name** from the Cloudinary dashboard
4. Edit `web/cloudinary.js` → replace `YOUR_CLOUD_NAME`
5. Edit `android/app/src/main/java/com/clipbyte/app/util/CloudinaryHelper.kt` → replace `CLOUD_NAME`

---

### Step 7 — Optional: Auto-Delete Cloud Function (Blaze plan required)

The app already does client-side cleanup (deletes expired clips on load). For server-side cleanup:

```bash
npm install -g firebase-tools
firebase login
firebase init functions   # choose existing project
firebase deploy --only functions
```

---

## 🔐 Security Notes

- `google-services.json` and `firebase-config.js` are in `.gitignore` — **never commit them**
- All Firestore data is isolated per user — no cross-user data access
- Clips auto-expire after 1 hour
- Use the Firestore rules in `firestore.rules` — do not use test mode in production

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Android | Kotlin, MVVM, Firebase SDK, Coil, OkHttp |
| Web | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| Database | Firebase Cloud Firestore |
| Auth | Firebase Authentication (Email/Password) |
| Image CDN | Cloudinary (optional) |
| Hosting | Firebase Hosting |

---

## 📄 License

MIT License — free to use, modify, and distribute.
