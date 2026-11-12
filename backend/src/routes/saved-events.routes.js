import { Router } from "express";
import { pool } from "../config/db.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

function publicSavedEvent(row) {
  return {
    id: row.id,
    promoter_id: row.promoter_id,
    title: row.title,
    description: row.description,
    artists: row.artists,
    venue: row.venue,
    city: row.city,
    start_at: row.start_at,
    end_at: row.end_at,
    host: row.host,
    ticket_price_info: row.ticket_price_info,
    booking_info: row.booking_info,
    status: row.status,
    label: row.label,
    verified_at: row.verified_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    saved_at: row.saved_at,
  };
}

// POST /api/events/:id/save — save an event
router.post("/:id/save", authenticate, async (req, res, next) => {
  try {
    const eventResult = await pool.query(
      `SELECT id FROM echoroom.events WHERE id = $1`,
      [req.params.id]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    await pool.query(
      `INSERT INTO echoroom.saved_events (user_id, event_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, event_id) DO NOTHING`,
      [req.user.id, req.params.id]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS count FROM echoroom.saved_events WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: "Event saved",
      saved_count: Number(countResult.rows[0].count),
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/events/:id/save — unsave an event
router.delete("/:id/save", authenticate, async (req, res, next) => {
  try {
    await pool.query(
      `DELETE FROM echoroom.saved_events
       WHERE user_id = $1 AND event_id = $2`,
      [req.user.id, req.params.id]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS count FROM echoroom.saved_events WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: "Event unsaved",
      saved_count: Number(countResult.rows[0].count),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/events/saved — authenticated user's saved events
router.get("/saved", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.promoter_id, e.title, e.description, e.artists, e.venue, e.city,
              e.start_at, e.end_at, e.host, e.ticket_price_info, e.booking_info,
              e.status, e.label, e.verified_at, e.verification_invalidated_at,
              e.created_at, e.updated_at,
              se.created_at AS saved_at
       FROM echoroom.saved_events se
       JOIN echoroom.events e ON e.id = se.event_id
       WHERE se.user_id = $1
         AND e.is_hidden = FALSE
       ORDER BY se.created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      events: result.rows.map(publicSavedEvent),
    });
  } catch (error) {
    next(error);
  }
});

export default router;