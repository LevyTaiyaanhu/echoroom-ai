import { Router } from "express";
import { pool } from "../config/db.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// POST /api/events/:id/like — like an event (no duplicate likes)
router.post("/events/:id/like", authenticate, async (req, res, next) => {
  try {
    const eventResult = await pool.query(
      `SELECT id FROM echoroom.events WHERE id = $1`,
      [req.params.id]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    await pool.query(
      `INSERT INTO echoroom.event_likes (user_id, event_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, event_id) DO NOTHING`,
      [req.user.id, req.params.id]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS count FROM echoroom.event_likes WHERE event_id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,
      message: "Event liked",
      like_count: Number(countResult.rows[0].count),
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/events/:id/like — unlike an event
router.delete("/events/:id/like", authenticate, async (req, res, next) => {
  try {
    await pool.query(
      `DELETE FROM echoroom.event_likes
       WHERE user_id = $1 AND event_id = $2`,
      [req.user.id, req.params.id]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS count FROM echoroom.event_likes WHERE event_id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,
      message: "Event unliked",
      like_count: Number(countResult.rows[0].count),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/events/:id/view — track an event-view estimate
router.post("/events/:id/view", async (req, res, next) => {
  try {
    const eventResult = await pool.query(
      `SELECT id FROM echoroom.events WHERE id = $1`,
      [req.params.id]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    await pool.query(
      `INSERT INTO echoroom.event_view_counts (event_id, view_count, updated_at)
       VALUES ($1, 1, NOW())
       ON CONFLICT (event_id) DO UPDATE SET
         view_count = echoroom.event_view_counts.view_count + 1,
         updated_at = NOW()`,
      [req.params.id]
    );

    const countResult = await pool.query(
      `SELECT view_count FROM echoroom.event_view_counts WHERE event_id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,
      message: "View tracked",
      view_count: countResult.rows[0]?.view_count ?? 0,
    });
  } catch (error) {
    next(error);
  }
});
// POST /api/events/:id/share — track a share-button action
router.post("/events/:id/share", authenticate, async (req, res, next) => {
  try {
    const { platform } = req.body;

    const eventResult = await pool.query(
      `SELECT id FROM echoroom.events WHERE id = $1`,
      [req.params.id]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    if (platform !== undefined && platform !== null) {
      if (typeof platform !== "string" || platform.trim().length < 1 || platform.trim().length > 50) {
        return res.status(400).json({ success: false, message: "platform must be 1-50 characters" });
      }
    }

    await pool.query(
      `INSERT INTO echoroom.event_shares (event_id, shared_by, platform, shared_at)
       VALUES ($1, $2, $3, NOW())`,
      [req.params.id, req.user.id, platform ? platform.trim() : null]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS count FROM echoroom.event_shares WHERE event_id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,
      message: "Share tracked",
      share_count: Number(countResult.rows[0].count),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/events/:id/engagement — engagement counts for an event (public)
router.get("/events/:id/engagement", async (req, res, next) => {
  try {
    const eventResult = await pool.query(
      `SELECT id FROM echoroom.events WHERE id = $1`,
      [req.params.id]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const likeResult = await pool.query(
      `SELECT COUNT(*) AS count FROM echoroom.event_likes WHERE event_id = $1`,
      [req.params.id]
    );
    const viewResult = await pool.query(
      `SELECT view_count FROM echoroom.event_view_counts WHERE event_id = $1`,
      [req.params.id]
    );
    const shareResult = await pool.query(
      `SELECT COUNT(*) AS count FROM echoroom.event_shares WHERE event_id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,
      engagement: {
        event_id: req.params.id,
        like_count: Number(likeResult.rows[0].count),
        view_count: viewResult.rows[0]?.view_count ?? 0,
        share_count: Number(shareResult.rows[0].count),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/promoters/me/engagement — aggregate engagement stats for the owning promoter
router.get("/promoters/me/engagement", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(e.id) AS total_events,
         COUNT(CASE WHEN e.status = 'active' THEN 1 END) AS active_events,
         COALESCE(SUM(el.like_count), 0) AS total_likes,
         COALESCE(SUM(ev.view_count), 0) AS total_views,
         COALESCE(SUM(es.share_count), 0) AS total_shares
       FROM echoroom.events e
       LEFT JOIN (
         SELECT event_id, COUNT(*) AS like_count
         FROM echoroom.event_likes GROUP BY event_id
       ) el ON el.event_id = e.id
       LEFT JOIN echoroom.event_view_counts ev ON ev.event_id = e.id
       LEFT JOIN (
         SELECT event_id, COUNT(*) AS share_count
         FROM echoroom.event_shares GROUP BY event_id
       ) es ON es.event_id = e.id
       WHERE e.promoter_id = $1
       GROUP BY e.promoter_id`,
      [req.user.id]
    );

    const row = result.rows[0] || {
      total_events: 0,
      active_events: 0,
      total_likes: 0,
      total_views: 0,
      total_shares: 0,
    };

    res.json({
      success: true,
      engagement: {
        promoter_id: req.user.id,
        total_events: Number(row.total_events),
        active_events: Number(row.active_events),
        total_likes: Number(row.total_likes),
        total_views: Number(row.total_views),
        total_shares: Number(row.total_shares),
        note: "View estimates and share-button clicks are indicators only; they do not equal attendance or successful WhatsApp delivery.",
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;