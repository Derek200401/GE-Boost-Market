const session = require("express-session");
const admin = require("firebase-admin");

class FirebaseSessionStore extends session.Store {
  constructor() {
    super();
    if (!admin.apps.length) {
      const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      let account;
      if (json) {
        try {
          const parsed = JSON.parse(json.trim());
          account = {
            projectId: parsed.projectId || parsed.project_id,
            clientEmail: parsed.clientEmail || parsed.client_email,
            privateKey: parsed.privateKey || parsed.private_key,
          };
          if (!account.projectId || !account.clientEmail || !account.privateKey) {
            account = null;
          }
        } catch {
          console.error("FIREBASE_SERVICE_ACCOUNT_JSON is invalid; trying separate Firebase variables.");
        }
      }
      if (!account) {
        account = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        };
      }
      if (!account.projectId || !account.clientEmail || !account.privateKey) {
        throw new Error("Firebase session store is not configured.");
      }
      admin.initializeApp({
        credential: admin.credential.cert(account),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    }
    this.ref = admin.database().ref("hydra/sessions");
  }

  get(sid, callback) {
    this.ref.child(sid).once("value")
      .then((snapshot) => callback(null, snapshot.val() || null))
      .catch(callback);
  }

  set(sid, sess, callback) {
    this.ref.child(sid).set(sess).then(() => callback?.(null)).catch(callback);
  }

  destroy(sid, callback) {
    this.ref.child(sid).remove().then(() => callback?.(null)).catch(callback);
  }

  touch(sid, sess, callback) {
    const updates = {};
    if (sess.cookie?.expires) updates["cookie/expires"] = sess.cookie.expires;
    if (sess.cookie?.maxAge) updates["cookie/maxAge"] = sess.cookie.maxAge;
    if (Object.keys(updates).length === 0) return callback?.(null);
    this.ref.child(sid).update(updates).then(() => callback?.(null)).catch(callback);
  }
}

function createSessionStore() {
  if (!process.env.FIREBASE_DATABASE_URL) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FIREBASE_DATABASE_URL is required in production.");
    }
    return undefined;
  }
  try {
    return new FirebaseSessionStore();
  } catch (error) {
    console.error("Firebase session store unavailable:", error.message);
    if (process.env.NODE_ENV === "production") throw error;
    return undefined;
  }
}

module.exports = { createSessionStore };