const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(
          /\\n/g,
          "\n"
        );
      }

      return serviceAccount;
    } catch (error) {
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT JSON");
    }
  }

  const serviceAccountPath = path.join(
    __dirname,
    "..",
    "serviceAccountKey.json"
  );

  try {
    return require(serviceAccountPath);
  } catch {
    throw new Error(
      "Firebase service account missing. Add backend/serviceAccountKey.json or FIREBASE_SERVICE_ACCOUNT env."
    );
  }
}

if (getApps().length === 0) {
  const serviceAccount = loadServiceAccount();

  initializeApp({
    credential: cert(serviceAccount)
  });

  console.log("✅ Firebase connected");
}

const db = getFirestore();

module.exports = {
  db
};