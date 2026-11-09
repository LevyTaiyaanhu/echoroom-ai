import { Router } from "express";
import { pool } from "../config/db.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { uploadSingle, handleMulterError } from "../middleware/upload.middleware.js";
import { extractEventFromImage, generateEventDescription } from "../lib/ai.js";

const router = Router();

// POST /api/ai/extract-flyer — extract event info from a flyer image (promoter only)
router.post(
  "/extract-flyer",
  authenticate,
  requireRole("promoter"),
  uploadSingle,
  handleMulterError,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No flyer image uploaded. Provide the image in the 'flyer' field.",
        });
      }

      const extracted = await extractEventFromImage(req.file.buffer, req.file.mimetype);

      res.json({
        success: true,
        message: "Flyer information extracted",
        extracted,
        note: "Review the extracted information before submitting the event. Nothing is published automatically.",
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/ai/detect-duplicates — compare extracted details against existing events
router.post("/detect-duplicates", authenticate, async (req, res, next) => {
  try {
    const { title, artists, venue, city, event_date, event_time } = req.body;

    if (!title || typeof title !== "string" || title.trim().length < 1) {
      return res.status(400).json({
        success: false,
        message: "title is required for duplicate detection",
      });
    }

    const conditions = [];
    const params = [];

    if (title) {
      params.push(`%${title.trim()}%`);
      conditions.push(`e.title ILIKE $${params.length}`);
    }
    if (venue) {
      params.push(`%${venue}%`);
      conditions.push(`e.venue ILIKE $${params.length}`);
    }
    if (city) {
      params.push(city);
      conditions.push(`e.city = $${params.length}`);
    }
    if (event_date) {
      params.push(`${event_date}%`);
      conditions.push(`e.start_at::text LIKE $${params.length}`);
    }

    if (conditions.length === 0) {
      return res.json({
        success: true,
        duplicates: [],
        message: "No searchable criteria provided",
      });
    }

    const sql = `
      SELECT e.id, e.promoter_id, e.title, e.description, e.artists, e.venue, e.city,
             e.start_at, e.end_at, e.host, e.ticket_price_info, e.booking_info,
             e.status, e.label, e.verified_at, e.verification_invalidated_at,
             e.created_at, e.updated_at, e.is_hidden
      FROM echoroom.events e
      WHERE ${conditions.join(" OR ")}
      ORDER BY e.start_at ASC
      LIMIT 10
    `;

    const result = await pool.query(sql, params);

    const duplicates = result.rows.map((row) => ({
      id: row.id,
      promoter_id: row.promoter_id,
      title: row.title,
      venue: row.venue,
      city: row.city,
      start_at: row.start_at,
      status: row.status,
      label: row.label,
      is_hidden: row.is_hidden,
    }));

    res.json({
      success: true,
      duplicates,
      message:
        duplicates.length > 0
          ? "Possible duplicate events found. Review before publishing."
          : "No duplicate events detected.",
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/generate-description — generate a professional event description (promoter only)
router.post(
  "/generate-description",
  authenticate,
  requireRole("promoter"),
  async (req, res, next) => {
    try {
      const { title, artists, venue, city, event_date, event_time, host, ticket_price, booking_info, description } = req.body;

      if (!title || typeof title !== "string" || title.trim().length < 1) {
        return res.status(400).json({
          success: false,
          message: "title is required to generate a description",
        });
      }

      const details = {};
      if (title) details.title = title;
      if (artists) details.artists = Array.isArray(artists) ? artists : [artists];
      if (venue) details.venue = venue;
      if (city) details.city = city;
      if (event_date) details.event_date = event_date;
      if (event_time) details.event_time = event_time;
      if (host) details.host = host;
      if (ticket_price) details.ticket_price = ticket_price;
      if (booking_info) details.booking_info = booking_info;
      if (description) details.existing_description = description;

      const generated = await generateEventDescription(details);

      res.json({
        success: true,
        message: "Event description generated",
        description: generated,
        note: "Review and edit the generated description before submitting the event.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;