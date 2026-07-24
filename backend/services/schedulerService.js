const cron = require("node-cron");
const { runRssPipeline } = require("./newsPipelineService");

let schedulerStarted = false;

function startScheduler() {
  if (schedulerStarted) return;

  if (process.env.ENABLE_RSS_SCHEDULER !== "true") {
    console.log("⏸ RSS scheduler disabled");
    return;
  }

  const cronExpression = process.env.RSS_SCHEDULE_CRON || "0 */3 * * *";

  if (!cron.validate(cronExpression)) {
    console.log("❌ Invalid RSS_SCHEDULE_CRON:", cronExpression);
    return;
  }

  schedulerStarted = true;

  cron.schedule(cronExpression, async () => {
    console.log("⏰ Scheduled RSS run started");

    try {
      const result = await runRssPipeline();

      console.log("✅ Scheduled RSS run completed", {
        checked: result.totalChecked,
        saved: result.totalSaved,
        merged: result.totalMerged,
        duplicates: result.totalDuplicates,
        aiCalls: result.totalOpenAiCalls
      });
    } catch (error) {
      console.error("❌ Scheduled RSS run failed:", error.message);
    }
  });

  console.log("✅ RSS scheduler started:", cronExpression);
}

module.exports = {
  startScheduler
};