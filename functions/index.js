/**
 * functions/index.js
 * Firebase Cloud Function — scheduled auto-delete of expired clipboard clips.
 *
 * Schedule: every 10 minutes.
 * Requires Firebase Blaze (pay-as-you-go) plan.
 *
 * Deploy:
 *   firebase deploy --only functions
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.deleteExpiredClips = functions.pubsub
    .schedule("every 10 minutes")
    .onRun(async () => {
        const now = Date.now();
        const usersSnap = await db.collection("users").listDocuments();

        const batchSize = 400; // Firestore batch limit is 500
        const promises = [];

        for (const userRef of usersSnap) {
            const expiredSnap = await userRef
                .collection("clipboard")
                .where("expiresAt", "<", now)
                .limit(batchSize)
                .get();

            if (expiredSnap.empty) continue;

            const batch = db.batch();
            expiredSnap.docs.forEach((doc) => batch.delete(doc.ref));
            promises.push(batch.commit());
        }

        await Promise.all(promises);
        console.log(`[deleteExpiredClips] Cleaned up at ${new Date(now).toISOString()}`);
        return null;
    });
