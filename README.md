# ClipByte ⚡ Universal Clipboard Sync

**ClipByte** is a powerful, real-time clipboard synchronization tool that allows you to sync text and images instantly between your **Android device** and your **Web browser**. No more emailing yourself links or images!

---

## 🚀 Features

-   **Instant Text Sync**: Paste text on Android, see it on the web instantly (and vice versa).
-   **Image Sync**: Upload images from your phone or drag-and-drop on the web.
-   **Auto-Deletion**: Clips automatically expire after **1 hour** to keep your clipboard clean and secure.
-   **Single Sign-On**: Secure authentication provided by Firebase.
-   **Premium UI**: A sleek, dark, and semi-transparent "glassmorphism" design.
-   **Cross-Platform**: Full Android app and responsive web dashboard.

---

## 🛠️ Tech Stack

-   **Frontend**: Vanilla JavaScript, HTML5, CSS3 (Glassmorphism).
-   **Backend**: Firebase Firestore (Real-time DB), Firebase Authentication.
-   **Android**: Kotlin, Material Design 3, Coroutines, Flow.
-   **Storage**: Cloudinary (Image Hosting).

---

## ⚙️ Setup Instructions

### 1. Firebase Setup (Database & Auth)
1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Create a new project named **ClipByte**.
3.  **Authentication**: Enable **Email/Password** sign-in method.
4.  **Firestore Database**: 
    - Create a database in "Production" or "Test" mode.
    - Set up the following collection structure: `users/{userId}/clipboard/{clipId}`.
    - Use the rules provided in `firestore.rules`.
5.  **Web App**: Register a Web App, copy the `firebaseConfig` and paste it into `web/firebase-config.js` (refer to `web/firebase-config.example.js`).
6.  **Android App**: Register an Android App (package name: `com.clipbyte.app`), download `google-services.json`, and place it in `android/app/`.

### 2. Cloudinary Setup (Image Hosting)
1.  Create a free account at [Cloudinary](https://cloudinary.com).
2.  Go to **Settings → Upload Settings → Upload Presets**.
3.  Add a new **Unsigned** upload preset:
    -   **Name**: `clipbyte_unsigned`
    -   **Folder**: `clipbyte`
4.  Update your cloud name and preset name in:
    -   `web/cloudinary.js` (refer to `web/cloudinary.example.js`)
    -   `android/app/src/main/java/com/clipbyte/app/util/CloudinaryHelper.kt` (refer to `android/app/src/main/java/com/clipbyte/app/util/CloudinaryHelper.example.kt`)

---

## 🏃 Running Locally

### Web
```bash
# Using any static server (e.g., Live Server or Serve)
npx serve web -p 3000
```
Visit `http://localhost:3000`.

### Android
1.  Open the `android/` folder in **Android Studio**.
2.  Connect your device and hit **Run**.

---

## 🔒 Security Note
This project has been configured to exclude all secrets (Firebase keys, Cloudinary presets) from Git trackers. Ensure you follow the `.example` files to set up your own environment.

---

## 👨‍💻 Author
**Adithyan**
[LinkedIn](https://www.linkedin.com/in/adithyan-me/)

Made with ❤️ for the Developer Community.
