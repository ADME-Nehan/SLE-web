const cron = require('node-cron');
const { runNewsPipeline } = require('./newsService');

// Run every 2 hours
cron.schedule('0 */2 * * *', async () => {
  console.log('⏰ [2hr] Scheduled pipeline triggered at', new Date().toISOString());
  try {
    await runNewsPipeline();
  } catch (err) {
    console.error('Scheduler error:', err.message);
  }
});

// Run once on startup after 8 second delay
setTimeout(async () => {
  console.log('🚀 Initial pipeline run on startup...');
  try {
    await runNewsPipeline();
  } catch (err) {
    console.error('Startup pipeline error:', err.message);
  }
}, 8000);

console.log('📅 Scheduler started — auto-fetch every 2 hours');
