const cron = require("node-cron");
const { runRssPipeline } = require("./newsPipelineService");

let isRunning = false;

function startScheduler() {
  const enabled = process.env.ENABLE_RSS_SCHEDULER === "true";

  if (!enabled) {
    console.log("⏸️ RSS scheduler disabled");
    return;
  }

  cron.schedule("*/30 * * * *", async () => {
    if (isRunning) {
      console.log("⏳ RSS scheduler skipped because previous run is still running");
      return;
    }

    isRunning = true;

    try {
      console.log("🔄 RSS scheduler started");
      const result = await runRssPipeline();

      console.log(
        `✅ RSS scheduler complete. Checked ${result.totalChecked}, saved ${result.totalSaved}, rejected ${result.totalRejected}, duplicates ${result.totalDuplicates}`
      );
    } catch (error) {
      console.error("❌ RSS scheduler failed:", error.message);
    } finally {
      isRunning = false;
    }
  });

  console.log("✅ RSS scheduler enabled. Runs every 30 minutes.");
}

module.exports = {
  startScheduler
};