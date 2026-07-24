const express = require("express");
const { db } = require("../config/firebase");
const { requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const [sourcesSnap, articlesSnap, runsSnap] = await Promise.all([
      db.collection("sources").get(),
      db.collection("articles").limit(500).get(),
      db.collection("rssRuns").orderBy("createdAt", "desc").limit(1).get()
    ]);

    const sources = sourcesSnap.docs.map((doc) => doc.data());
    const articles = articlesSnap.docs.map((doc) => doc.data());

    const activeSources = sources.filter((source) => source.active !== false);
    const topNews = articles.filter((article) => article.isTopNews === true);

    const failedSources = sources.filter(
      (source) => source.lastStatus === "failed"
    );

    const latestRun = runsSnap.empty
      ? null
      : {
          id: runsSnap.docs[0].id,
          ...runsSnap.docs[0].data()
        };

    res.json({
      success: true,
      stats: {
        totalSources: sources.length,
        activeSources: activeSources.length,
        failedSources: failedSources.length,
        totalArticles: articles.length,
        topNewsCount: topNews.length,
        latestRun,
        lastRunAt: latestRun?.createdAt || null,
        lastOpenAiCalls:
          latestRun?.totalOpenAiCalls || latestRun?.openAiCalls || 0,
        lastSaved:
          latestRun?.totalSaved || latestRun?.savedCount || 0,
        lastMerged:
          latestRun?.totalMerged || latestRun?.mergedCount || 0,
        lastDuplicates:
          latestRun?.totalDuplicates || latestRun?.duplicateCount || 0,
        lastRejected:
          latestRun?.totalRejected || latestRun?.rejectedCount || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;