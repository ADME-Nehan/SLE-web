const express = require("express");
const { db } = require("../config/firebase");
const { normalizeUrl, cleanText } = require("../utils/helpers");
const {
  runRssPipeline,
  fetchOneSource
} = require("../services/newsPipelineService");

const router = express.Router();

function guessNameFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    const name = host.split(".")[0];

    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "RSS Source";
  }
}

router.get("/", async (req, res) => {
  try {
    const snap = await db
      .collection("sources")
      .orderBy("createdAt", "desc")
      .get();

    const sources = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      sources
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const rssUrl = normalizeUrl(req.body.rssUrl || req.body.url);
    const websiteUrl = normalizeUrl(req.body.websiteUrl || "");

    if (!rssUrl) {
      return res.status(400).json({
        success: false,
        error: "Valid RSS URL is required"
      });
    }

    const existing = await db
      .collection("sources")
      .where("rssUrl", "==", rssUrl)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({
        success: false,
        error: "RSS source already exists"
      });
    }

    const payload = {
      name: cleanText(req.body.name) || guessNameFromUrl(rssUrl),
      rssUrl,
      url: rssUrl,
      websiteUrl,

      category: "Auto",
      autoCategory: true,

      active: req.body.active !== false,
      type: "rss",

      lastFetchedAt: null,
      lastStatus: "not_started",
      lastItemCount: 0,
      lastAcceptedCount: 0,
      lastRejectedCount: 0,
      lastSavedCount: 0,
      lastMergedCount: 0,
      lastDuplicateCount: 0,
      lastError: null,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const ref = await db.collection("sources").add(payload);

    res.json({
      success: true,
      id: ref.id,
      source: {
        id: ref.id,
        ...payload
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const update = {
      updatedAt: new Date().toISOString()
    };

    if (req.body.name !== undefined) {
      update.name = cleanText(req.body.name);
    }

    if (req.body.rssUrl !== undefined || req.body.url !== undefined) {
      const rssUrl = normalizeUrl(req.body.rssUrl || req.body.url);

      if (!rssUrl) {
        return res.status(400).json({
          success: false,
          error: "Valid RSS URL is required"
        });
      }

      update.rssUrl = rssUrl;
      update.url = rssUrl;
    }

    if (req.body.websiteUrl !== undefined) {
      update.websiteUrl = normalizeUrl(req.body.websiteUrl);
    }

    update.category = "Auto";
    update.autoCategory = true;

    if (req.body.active !== undefined) {
      update.active = req.body.active === true;
    }

    await db.collection("sources").doc(req.params.id).update(update);

    res.json({
      success: true,
      id: req.params.id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.collection("sources").doc(req.params.id).delete();

    res.json({
      success: true,
      message: "Source deleted"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post("/:id/fetch", async (req, res) => {
  try {
    const snap = await db.collection("sources").doc(req.params.id).get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: "Source not found"
      });
    }

    const source = {
      id: snap.id,
      ...snap.data()
    };

    const result = await fetchOneSource(source);

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

router.post("/run/all", async (req, res) => {
  try {
    const result = await runRssPipeline();

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