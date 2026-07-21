const express = require("express");
const {
  readRssFeed,
  readAndFilterRssFeed
} = require("../services/rssService");

const router = express.Router();

router.get("/test", async (req, res) => {
  try {
    const rssUrl = req.query.url;

    if (!rssUrl) {
      return res.status(400).json({
        success: false,
        error: "RSS URL is required. Example: /api/rss/test?url=https://example.com/feed"
      });
    }

    const result = await readRssFeed(rssUrl);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/filter", async (req, res) => {
  try {
    const rssUrl = req.query.url;

    if (!rssUrl) {
      return res.status(400).json({
        success: false,
        error:
          "RSS URL is required. Example: /api/rss/filter?url=https://example.com/feed"
      });
    }

    const result = await readAndFilterRssFeed(rssUrl);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post("/filter", async (req, res) => {
  try {
    const rssUrl = req.body.rssUrl || req.body.url;

    if (!rssUrl) {
      return res.status(400).json({
        success: false,
        error: "RSS URL is required"
      });
    }

    const result = await readAndFilterRssFeed(rssUrl);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;