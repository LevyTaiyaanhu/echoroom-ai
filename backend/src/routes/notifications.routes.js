import { Router } from "express";
import { pool } from "../config/db.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

function publicNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    event_id: row.event_id,
    related_entity_type: row.related_entity_type,
    related_entity_id: row.related_entity_id,
    is_read: row.is_read,
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

router.get("/notifications", authenticate, async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const params = [req.user.id];
    let paramIdx = 2;

    let sql = `
      SELECT id, user_id, type, title, message, event_id,
             related_entity_type, related_entity_id, is_read, read_at, created_at
      FROM echoroom.notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    if (limit !== undefined) {
      const lim = Number(limit);
      if (!Number.isInteger(lim) || lim < 1 || lim > 100) {
        return res.status(400).json({ success: false, message: "limit must be an integer between 1 and 100" });
      }
      params.push(lim);
      sql += ` LIMIT $${paramIdx++}`;
    }
    if (offset !== undefined) {
      const off = Number(offset);
      if (!Number.isInteger(off) || off < 0) {
        return res.status(400).json({ success: false, message: "offset must be a non-negative integer" });
      }
      params.push(off);
      sql += ` OFFSET $${paramIdx++}`;
    }

    const result = await pool.query(sql, params);
    res.json({
      success: true,
      notifications: result.rows.map(publicNotification),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/notifications/unread-count", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) AS count FROM echoroom.notifications WHERE user_id = $1 AND is_read = FALSE",
      [req.user.id]
    );
    res.json({
      success: true,
      unread_count: Number(result.rows[0].count),
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/notifications/:id/read", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE echoroom.notifications
        SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    next(error);
  }
});

router.patch("/notifications/read-all", authenticate, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE echoroom.notifications
        SET is_read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
});

router.get("/notifications/preferences", authenticate, async (req, res, next) => {
  try {
    await pool.query(
      `INSERT INTO echoroom.notification_preferences (user_id, event_reminders, new_events_from_followed, saved_event_changes)
       VALUES ($1, TRUE, TRUE, TRUE)
       ON CONFLICT (user_id) DO NOTHING`,
      [req.user.id]
    );

    const result = await pool.query(
      `SELECT user_id, event_reminders, new_events_from_followed, saved_event_changes,
              created_at, updated_at
       FROM echoroom.notification_preferences
       WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({ success: true, preferences: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch("/notifications/preferences", authenticate, async (req, res, next) => {
  try {
    const { event_reminders, new_events_from_followed, saved_event_changes } = req.body;

    const updateFields = [];
    const updateValues = [];
    let paramIdx = 1;

    const setField = (field, value) => {
      updateFields.push(`${field} = $${paramIdx++}`);
      updateValues.push(value);
    };

    if (event_reminders !== undefined) {
      if (typeof event_reminders !== "boolean") {
        return res.status(400).json({ success: false, message: "event_reminders must be a boolean" });
      }
      setField("event_reminders", event_reminders);
    }
    if (new_events_from_followed !== undefined) {
      if (typeof new_events_from_followed !== "boolean") {
        return res.status(400).json({ success: false, message: "new_events_from_followed must be a boolean" });
      }
      setField("new_events_from_followed", new_events_from_followed);
    }
    if (saved_event_changes !== undefined) {
      if (typeof saved_event_changes !== "boolean") {
        return res.status(400).json({ success: false, message: "saved_event_changes must be a boolean" });
      }
      setField("saved_event_changes", saved_event_changes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    await pool.query(
      `INSERT INTO echoroom.notification_preferences (user_id, event_reminders, new_events_from_followed, saved_event_changes)
       VALUES ($1, TRUE, TRUE, TRUE)
       ON CONFLICT (user_id) DO NOTHING`,
      [req.user.id]
    );

    updateValues.push(req.user.id);
    const sql = `UPDATE echoroom.notification_preferences SET ${updateFields.join(", ")}
       WHERE user_id = $${paramIdx}
       RETURNING user_id, event_reminders, new_events_from_followed, saved_event_changes, updated_at`;

    const result = await pool.query(sql, updateValues);

    res.json({
      success: true,
      message: "Notification preferences updated",
      preferences: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
