import { Router } from "express";
import { pool } from "../config/db.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

const HIDDEN_LABEL_MAP = {
  hide: "unconfirmed",
  unhide: "posted_by_promoter",
};

// POST /api/events/:id/report — authenticated user reports an event
router.post("/events/:id/report", authenticate, async (req, res, next) => {
  try {
    const { reason, description } = req.body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 1 || reason.trim().length > 500) {
      return res.status(400).json({ success: false, message: "reason is required (1-500 characters)" });
    }
    if (description !== undefined && description !== null) {
      if (typeof description !== "string" || description.length > 2000) {
        return res.status(400).json({ success: false, message: "description must be at most 2000 characters" });
      }
    }

    const eventResult = await pool.query(
      `SELECT id FROM echoroom.events WHERE id = $1`,
      [req.params.id]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    await pool.query(
      `INSERT INTO echoroom.event_reports (event_id, reporter_id, reason, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id, reporter_id) DO NOTHING`,
      [req.params.id, req.user.id, reason.trim(), description ? description.trim() : null]
    );

    res.status(201).json({ success: true, message: "Report submitted" });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports — admin lists reports (open by default)
router.get("/admin/reports", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    let sql = `
      SELECT r.id, r.event_id, r.reporter_id, r.reason, r.description, r.status,
             r.created_at, r.reviewed_at, r.reviewed_by,
             e.title AS event_title
      FROM echoroom.event_reports r
      JOIN echoroom.events e ON e.id = r.event_id
    `;
    if (status) {
      params.push(status);
      sql += ` WHERE r.status = $${params.length}`;
    }
    sql += ` ORDER BY r.created_at DESC`;

    const result = await pool.query(sql, params);
    res.json({ success: true, reports: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/reports/:id/review — admin reviews a report and decides hide/unhide/verify/unverify
router.post("/admin/reports/:id/review", authenticate, requireRole("admin"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { decision, public_note, private_note } = req.body;

    if (!decision || !["hide", "unhide", "verify", "unverify"].includes(decision)) {
      return res.status(400).json({ success: false, message: "decision must be one of: hide, unhide, verify, unverify" });
    }
    if (public_note !== undefined && public_note !== null && (typeof public_note !== "string" || public_note.length > 1000)) {
      return res.status(400).json({ success: false, message: "public_note must be at most 1000 characters" });
    }
    if (private_note !== undefined && private_note !== null && (typeof private_note !== "string" || private_note.length > 4000)) {
      return res.status(400).json({ success: false, message: "private_note must be at most 4000 characters" });
    }

    await client.query("BEGIN");

    const reportResult = await client.query(
      `SELECT id, event_id, status FROM echoroom.event_reports WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    const report = reportResult.rows[0];
    if (!report) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    if (report.status !== "open") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: `Report already ${report.status}` });
    }

    await client.query(
      `INSERT INTO echoroom.moderation_decisions (event_id, decided_by, decision, public_note, private_note)
       VALUES ($1, $2, $3, $4, $5)`,
      [report.event_id, req.user.id, decision, public_note ?? null, private_note ?? null]
    );

    await client.query(
      `UPDATE echoroom.event_reports SET status = 'reviewed', reviewed_at = NOW(), reviewed_by = $1 WHERE id = $2`,
      [req.user.id, req.params.id]
    );

    if (decision === "hide") {
      await client.query(
        `UPDATE echoroom.events SET is_hidden = TRUE, label = $1 WHERE id = $2`,
        [HIDDEN_LABEL_MAP.hide, report.event_id]
      );
    } else if (decision === "unhide") {
      await client.query(
        `UPDATE echoroom.events SET is_hidden = FALSE, label = $1 WHERE id = $2`,
        [HIDDEN_LABEL_MAP.unhide, report.event_id]
      );
    } else if (decision === "verify") {
      await client.query(
        `UPDATE echoroom.events SET label = 'verified', verified_at = NOW(), verified_by = $1 WHERE id = $2`,
        [req.user.id, report.event_id]
      );
    } else if (decision === "unverify") {
      await client.query(
        `UPDATE echoroom.events SET label = 'posted_by_promoter', verified_at = NULL, verified_by = NULL WHERE id = $2`,
        [report.event_id]
      );
    }

    await client.query("COMMIT");

    res.json({ success: true, message: `Report reviewed: ${decision}` });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

// GET /api/admin/events/:id/moderation-log — admin views decision history for an event (private notes included)
router.get("/admin/events/:id/moderation-log", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, event_id, decided_by, decision, public_note, private_note, created_at
       FROM echoroom.moderation_decisions
       WHERE event_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, decisions: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;