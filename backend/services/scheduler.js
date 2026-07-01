const cron = require("node-cron");
const { db } = require("../config/firebase");
const newsService = require("./newsService");

const runPipeline = newsService.runNewsPipeline || newsService.scanAllSources;

let started = false;
let running = false;

async function executePipeline(reason = "manual") {
  if (!runPipeline) {
    console.error(
      "❌ No pipeline function found. Export runNewsPipeline or scanAllSources from newsService.js"
    );
    return;
  }

  if (running) {
    console.log("⏳ Pipeline already running. Skipping duplicate run.");
    return;
  }

  running = true;

  console.log(`⏰ [${reason}] Pipeline triggered at ${new Date().toISOString()}`);

  try {
    const result = await runPipeline();

    console.log("✅ Pipeline completed:", result || "Done");
  } catch (err) {
    console.error("❌ Pipeline error:", err.message);
  } finally {
    running = false;
  }
}

async function deleteOldArticles(days = 10) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffIso = cutoffDate.toISOString();

  try {
    const snap = await db
      .collection("articles")
      .where("createdAt", "<=", cutoffIso)
      .get();

    if (snap.empty) {
      console.log(`🧹 No articles older than ${days} day(s) found.`);
      return 0;
    }

    const docs = snap.docs;
    let deletedCount = 0;

    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + 500);

      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deletedCount += chunk.length;
    }

    console.log(`🧹 Deleted ${deletedCount} article(s) older than ${days} day(s).`);
    return deletedCount;
  } catch (error) {
    console.error("❌ Old data cleanup failed:", error.message);
    return 0;
  }
}

function startScheduler() {
  if (started) return;

  started = true;

  const scanSchedule = process.env.SCAN_CRON || "0 * * * *";
  const cleanupSchedule = process.env.DELETE_OLD_DATA_CRON || "0 2 * * *";
  const cleanupDays = Number(process.env.DELETE_OLD_DATA_DAYS || 10);

  cron.schedule(
    scanSchedule,
    async () => {
      await executePipeline("1hr");
    },
    {
      timezone: "Asia/Colombo"
    }
  );

  cron.schedule(
    cleanupSchedule,
    async () => {
      await deleteOldArticles(cleanupDays);
    },
    {
      timezone: "Asia/Colombo"
    }
  );

  setTimeout(async () => {
    await executePipeline("startup");
  }, 8000);

  setTimeout(async () => {
    await deleteOldArticles(cleanupDays);
  }, 15000);

  console.log(`📅 Scheduler started — auto-fetch schedule: ${scanSchedule}`);
  console.log(
    `🧹 Data cleanup scheduled — every ${cleanupSchedule} (delete older than ${cleanupDays} day(s))`
  );
}

// Auto start when this file is required
startScheduler();

module.exports = {
  startScheduler,
  executePipeline,
  deleteOldArticles
};