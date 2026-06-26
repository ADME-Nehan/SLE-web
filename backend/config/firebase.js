const path = require("path");
const fs = require("fs");

const admin = require("firebase-admin");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

let db;

function loadServiceAccount() {
  const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");

  if (fs.existsSync(serviceAccountPath)) {
    console.log("🔑 Using serviceAccountKey.json");
    return require(serviceAccountPath);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log("🔑 Using FIREBASE_SERVICE_ACCOUNT from .env");

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }

    return serviceAccount;
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    console.log("🔑 Using individual Firebase values from .env");

    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    };
  }

  throw new Error(
    "Firebase service account not found. Add serviceAccountKey.json to backend root."
  );
}

try {
  const serviceAccount = loadServiceAccount();

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }

  db = getFirestore();

  console.log("✅ Firebase Firestore connected");
} catch (error) {
  console.error("❌ Firebase init error:", error.message);
  process.exit(1);
}

module.exports = {
  admin,
  db,
  FieldValue
};