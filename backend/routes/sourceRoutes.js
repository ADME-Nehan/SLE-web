const express = require("express");
const { db } = require("../config/firebase");
const { normalizeUrl, cleanText } = require("../utils/helpers");
const {
  runRssPipeline,
  fetchOneSource
} = require("../services/newsPipelineService");
const { discoverRssFeeds } = require("../services/rssDiscoveryService");
const { validateRssSource } = require("../services/rssService");
const { requireAdmin } = require("../middleware/authMiddleware");

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

router.post("/discover", requireAdmin, async (req, res) => {
  const websiteUrl = String(req.body.websiteUrl || "").trim();

  try {
    const result = await discoverRssFeeds(websiteUrl);

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error(`[RSS discovery] route failed safely: ${error.message}`);

    return res.json({
      success: true,
      result: {
        websiteUrl,
        foundCount: 0,
        candidates: [],
        message:
          "No valid RSS/Atom feeds found. You can paste the RSS URL manually."
      }
    });
  }
});

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
    const requestedRssUrl = String(req.body.rssUrl || req.body.url || "").trim();
    const websiteUrl = normalizeUrl(req.body.websiteUrl || "");

    if (!requestedRssUrl) {
      return res.status(400).json({
        success: false,
        error: "RSS URL is required."
      });
    }

    let validation;

    try {
      validation = await validateRssSource(requestedRssUrl);
    } catch (error) {
      return res.status(422).json({
        success: false,
        error: error.message,
        sourceStatus: error.sourceStatus || "failed"
      });
    }

    const rssUrl = validation.rssUrl;

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

    const active = req.body.active !== false;
    const payload = {
      name: cleanText(req.body.name) || guessNameFromUrl(rssUrl),
      rssUrl,
      url: rssUrl,
      websiteUrl,

      category: "Auto",
      autoCategory: true,

      active,
      type: validation.type,
      sourceStatus: active ? "active" : "disabled",

      lastFetchedAt: null,
      lastStatus: "validated",
      lastCheckedAt: validation.checkedAt,
      failureCount: 0,
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
    const sourceRef = db.collection("sources").doc(req.params.id);
    const sourceSnap = await sourceRef.get();

    if (!sourceSnap.exists) {
      return res.status(404).json({
        success: false,
        error: "Source not found"
      });
    }

    const currentSource = sourceSnap.data();
    const update = {
      updatedAt: new Date().toISOString()
    };

    if (req.body.name !== undefined) {
      update.name = cleanText(req.body.name);
    }

    const rssUrlWasProvided =
      req.body.rssUrl !== undefined || req.body.url !== undefined;
    const shouldValidate =
      rssUrlWasProvided ||
      (req.body.active === true && currentSource.sourceStatus !== "active");

    if (shouldValidate) {
      const requestedRssUrl = rssUrlWasProvided
        ? req.body.rssUrl || req.body.url
        : currentSource.rssUrl || currentSource.url;

      try {
        const validation = await validateRssSource(requestedRssUrl);
        update.rssUrl = validation.rssUrl;
        update.url = validation.rssUrl;
        update.type = validation.type;
        update.lastCheckedAt = validation.checkedAt;
        update.lastStatus = "validated";
        update.lastError = null;
        update.failureCount = 0;
        update.sourceStatus = req.body.active === false ? "disabled" : "active";
      } catch (error) {
        const failureCount = Number(currentSource.failureCount || 0) + 1;

        await sourceRef.update({
          active: false,
          sourceStatus:
            failureCount >= 3
              ? "disabled"
              : error.sourceStatus || "failed",
          lastStatus: "validation_failed",
          lastError: error.message,
          lastCheckedAt: new Date().toISOString(),
          failureCount,
          updatedAt: new Date().toISOString()
        });

        return res.status(422).json({
          success: false,
          error: error.message,
          sourceStatus: error.sourceStatus || "failed"
        });
      }
    }

    if (req.body.websiteUrl !== undefined) {
      update.websiteUrl = normalizeUrl(req.body.websiteUrl);
    }

    update.category = "Auto";
    update.autoCategory = true;

    if (req.body.active !== undefined) {
      update.active = req.body.active === true;

      if (req.body.active === false) {
        update.sourceStatus = "disabled";
        update.lastStatus = "disabled";
      } else if (update.sourceStatus === undefined) {
        update.sourceStatus = "active";
      }
    }

    await sourceRef.update(update);

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

    if (source.active !== true || source.sourceStatus !== "active") {
      return res.status(400).json({
        success: false,
        error: "Source is not active. Validate and enable it before fetching."
      });
    }

    const result = await fetchOneSource(source);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    const timedOut =
      error.code === "RSS_TIMEOUT" ||
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT" ||
      /timed?\s*out|timeout/i.test(error.message || "");

    res.status(timedOut ? 504 : 500).json({
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
