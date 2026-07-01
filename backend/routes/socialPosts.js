const express = require("express");
const {
  generateSocialPostPreview,
  saveSocialPost,
  getSocialPosts,
  deleteSocialPost
} = require("../services/socialPostService");

const router = express.Router();

function requireAdmin(req, res, next) {
  if (process.env.DISABLE_AUTH === "true") {
    return next();
  }

  const key = req.headers["x-admin-key"];

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({
      success: false,
      error: "ADMIN_PASSWORD is not set on backend"
    });
  }

  if (key !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });
  }

  return next();
}

router.get("/", requireAdmin, async (req, res) => {
  try {
    const posts = await getSocialPosts();

    res.json({
      success: true,
      posts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post("/preview", requireAdmin, async (req, res) => {
  try {
    const { url, platform } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "URL is required"
      });
    }

    const post = await generateSocialPostPreview({
      url,
      platform
    });

    res.json({
      success: true,
      post
    });
  } catch (error) {
    console.error("Social post preview error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const post = req.body;

    if (!post || !post.title) {
      return res.status(400).json({
        success: false,
        error: "Post data is required"
      });
    }

    const id = await saveSocialPost(post);

    res.json({
      success: true,
      id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await deleteSocialPost(req.params.id);

    res.json({
      success: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;