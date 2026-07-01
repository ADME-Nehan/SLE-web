const cron = require("node-cron");
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

function startScheduler() {
  if (started) return;

  started = true;

  // Every 1 hour
  const schedule = process.env.SCAN_CRON || "0 * * * *";

  cron.schedule(
    schedule,
    async () => {
      await executePipeline("1hr");
    },
    {
      timezone: "Asia/Colombo"
    }
  );

  // Run once on startup after 8 seconds
  setTimeout(async () => {
    await executePipeline("startup");
  }, 8000);

  console.log(`📅 Scheduler started — auto-fetch schedule: ${schedule}`);
}

// Auto start when this file is required
startScheduler();

module.exports = {
  startScheduler,
  executePipeline
};