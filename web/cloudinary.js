// ============================================================
//  cloudinary.js
//  Unsigned upload to Cloudinary.
//
//  1. Create a free account at https://cloudinary.com
//  2. Go to Settings → Upload Presets → Add upload preset
//     - Signing Mode: Unsigned
//     - Name: clipbyte_unsigned
//     - Allowed formats: jpg,jpeg,png,webp
//     - Max file size: 5 MB (5,242,880 bytes)
//  3. Replace YOUR_CLOUD_NAME below with your Cloudinary cloud name.
// ============================================================

const CLOUDINARY_CLOUD_NAME = "YOUR_CLOUD_NAME";
const CLOUDINARY_UPLOAD_PRESET = "clipbyte_unsigned";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Validates and uploads a File to Cloudinary.
 * @param {File} file
 * @param {function(number):void} onProgress  — called with 0-100 progress value
 * @returns {Promise<string>}  secure_url of the uploaded image
 */
export async function uploadToCloudinary(file, onProgress = () => { }) {
    // --- Client-side validation ---
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Invalid file type: ${file.type}. Only JPG, PNG, WEBP allowed.`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`);
    }

    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "clipbyte");

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);

        xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });

        xhr.addEventListener("load", () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                resolve(data.secure_url);
            } else {
                reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
            }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.send(formData);
    });
}
