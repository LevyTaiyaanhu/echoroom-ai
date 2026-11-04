import { Router } from "express";
import { pool } from "../config/db.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

const MATERIAL_FIELDS = [
  "title",
  "description",
  "artists",
  "venue",
  "city",
  "start_at",
  "end_at",
];

function parseArtists(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return trimmed.split(/\s*,\s*/).filter(Boolean);
  }
  return undefined;
}

function validateEventBody(body) {
  const errors = [];

  if (body.title === undefined || body.title === null) {
    errors.push("title is required");
  } else if (
    typeof body.title !== "string" ||
    body.title.trim().length < 1 ||
    body.title.trim().length > 200
  ) {
    errors.push("title must be 1-200 characters");
  }

  const artists = parseArtists(body.artists);
  if (artists === undefined) {
    errors.push("artists is required (array or comma-separated string)");
  } else if (artists.length === 0) {
    errors.push("artists must not be empty");
  }

  if (body.venue === undefined || body.venue === null) {
    errors.push("venue is required");
  } else if (
    typeof body.venue !== "string" ||
    body.venue.trim().length < 1 ||
    body.venue.trim().length > 200
  ) {
    errors.push("venue must be 1-200 characters");
  }

  if (body.city === undefined || body.city === null) {
    errors.push("city is required");
  } else if (
    typeof body.city !== "string" ||
    body.city.trim().length < 1 ||
    body.city.trim().length > 100
  ) {
    errors.push("city must be 1-100 characters");
  }

  const startAt = new Date(body.start_at);
  const endAt = new Date(body.end_at);
  if (isNaN(startAt.getTime())) errors.push("start_at must be a valid ISO timestamp");
  if (isNaN(endAt.getTime())) errors.push("end_at must be a valid ISO timestamp");
  if (!isNaN(startAt.getTime()) && !isNaN(endAt.getTime()) && endAt <= startAt) {
    errors.push("end_at must be after start_at");
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string" || body.description.length > 5000) {
      errors.push("description must be at most 5000 characters");
    }
  }
  if (body.host !== undefined && body.host !== null) {
    if (typeof body.host !== "string" || body.host.trim().length > 200) {
      errors.push("host must be at most 200 characters");
    }
  }
  if (body.ticket_price_info !== undefined && body.ticket_price_info !== null) {
    if (typeof body.ticket_price_info !== "string" || body.ticket_price_info.length > 500) {
      errors.push("ticket_price_info must be at most 500 characters");
    }
  }
  if (body.booking_info !== undefined && body.booking_info !== null) {
    if (typeof body.booking_info !== "string" || body.booking_info.length > 500) {
      errors.push("booking_info must be at most 500 characters");
    }
  }

  return { errors, artists, startAt, endAt };
}

function publicEvent(row, isOwner) {
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
    verification_invalidated_at: row.verification_invalidated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_hidden: row.is_hidden,
    ...(isOwner ? { can_edit: true } : {}),
  };
}

// POST /api/events — promoter creates an event
router.post("/", authenticate, requireRole("promoter"), async (req, res, next) => {
  try {
    const { errors, artists, startAt, endAt } = validateEventBody(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join("; ") });
    }

    const {
      title,
      description,
      venue,
      city,
      host,
      ticket_price_info,
      booking_info,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO echoroom.events
        (promoter_id, title, description, artists, venue, city, start_at, end_at, host, ticket_price_info, booking_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, promoter_id, title, description, artists, venue, city, start_at, end_at,
                 host, ticket_price_info, booking_info, status, label, verified_at,
                 verification_invalidated_at, created_at, updated_at`,
      [
        req.user.id,
        title.trim(),
        description ?? null,
        artists,
        venue.trim(),
        city.trim(),
        startAt.toISOString(),
        endAt.toISOString(),
        host ? host.trim() : null,
        ticket_price_info ?? null,
        booking_info ?? null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Event created",
      event: publicEvent(result.rows[0], true),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/events — active, non-expired feed with search/filter
router.get("/", async (req, res, next) => {
  try {
    const { q, city, from, to } = req.query;
    const params = [];
    let sql = `
      SELECT e.id, e.promoter_id, e.title, e.description, e.artists, e.venue, e.city,
             e.start_at, e.end_at, e.host, e.ticket_price_info, e.booking_info,
             e.status, e.label, e.verified_at, e.verification_invalidated_at,
             e.created_at, e.updated_at
      FROM echoroom.events e
      WHERE e.status = 'active'
        AND e.start_at > NOW()
        AND e.is_hidden = FALSE
    `;

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (e.title ILIKE $${params.length} OR e.city ILIKE $${params.length} OR e.venue ILIKE $${params.length})`;
    }
    if (city) {
      params.push(city);
      sql += ` AND e.city = $${params.length}`;
    }
    if (from) {
      params.push(from);
      sql += ` AND e.start_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      sql += ` AND e.start_at <= $${params.length}`;
    }

    sql += ` ORDER BY e.start_at ASC`;

    const result = await pool.query(sql, params);
    res.json({ success: true, events: result.rows.map((row) => publicEvent(row, false)) });
  } catch (error) {
    next(error);
  }
});

// GET /api/events/archive — cancelled and expired events (public archive view)
router.get("/archive", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.promoter_id, e.title, e.description, e.artists, e.venue, e.city,
              e.start_at, e.end_at, e.host, e.ticket_price_info, e.booking_info,
              e.status, e.label, e.verified_at, e.verification_invalidated_at,
              e.created_at, e.updated_at
       FROM echoroom.events e
       WHERE e.status IN ('archived', 'cancelled')
          OR e.start_at <= NOW()
       ORDER BY e.start_at DESC`
    );

    res.json({ success: true, events: result.rows.map((row) => publicEvent(row, false)) });
  } catch (error) {
    next(error);
  }
});

// GET /api/events/:id — event detail
router.get("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.promoter_id, e.title, e.description, e.artists, e.venue, e.city,
              e.start_at, e.end_at, e.host, e.ticket_price_info, e.booking_info,
              e.status, e.label, e.verified_at, e.verified_by,
              e.verification_invalidated_at, e.created_at, e.updated_at, e.is_hidden
       FROM echoroom.events e
       WHERE e.id = $1`,
      [req.params.id]
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    res.json({ success: true, event: publicEvent(row, false) });
  } catch (error) {
    next(error);
  }
});

// PUT /api/events/:id — promoter edits own event; material changes invalidate verification
router.put("/:id", authenticate, requireRole("promoter"), async (req, res, next) => {
  try {
    const existing = await pool.query(
      `SELECT promoter_id, title, description, artists, venue, city, start_at, end_at, label
       FROM echoroom.events WHERE id = $1`,
      [req.params.id]
    );

    const row = existing.rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    if (row.promoter_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "You can only edit your own events" });
    }

    const { errors, artists, startAt, endAt } = validateEventBody(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join("; ") });
    }

    const {
      title,
      description,
      venue,
      city,
      host,
      ticket_price_info,
      booking_info,
    } = req.body;

    const newArtists = artists ?? row.artists;
    const newStart = startAt ?? new Date(row.start_at);
    const newEnd = endAt ?? new Date(row.end_at);

    const materialChanged =
      (req.body.title !== undefined && req.body.title.trim() !== row.title) ||
      (req.body.description !== undefined && req.body.description !== row.description) ||
      (req.body.artists !== undefined && JSON.stringify(newArtists) !== JSON.stringify(row.artists)) ||
      (req.body.venue !== undefined && req.body.venue.trim() !== row.venue) ||
      (req.body.city !== undefined && req.body.city.trim() !== row.city) ||
      (req.body.start_at !== undefined && newStart.getTime() !== new Date(row.start_at).getTime()) ||
      (req.body.end_at !== undefined && newEnd.getTime() !== new Date(row.end_at).getTime());

    const updateFields = [];
    const updateValues = [];
    let paramIdx = 1;

    const setField = (field, value) => {
      updateFields.push(`${field} = $${paramIdx++}`);
      updateValues.push(value);
    };

    setField("title", title.trim());
    setField("description", description ?? null);
    setField("artists", newArtists);
    setField("venue", venue.trim());
    setField("city", city.trim());
    setField("start_at", newStart.toISOString());
    setField("end_at", newEnd.toISOString());
    if (host !== undefined) setField("host", host ? host.trim() : null);
    if (ticket_price_info !== undefined) setField("ticket_price_info", ticket_price_info ?? null);
    if (booking_info !== undefined) setField("booking_info", booking_info ?? null);

    if (materialChanged) {
      setField("label", "posted_by_promoter");
      setField("verified_at", null);
      setField("verified_by", null);
      setField("verification_invalidated_at", new Date().toISOString());
    }

    updateValues.push(req.params.id);
    const sql = `UPDATE echoroom.events SET ${updateFields.join(", ")} WHERE id = $${paramIdx}
       RETURNING id, promoter_id, title, description, artists, venue, city, start_at, end_at,
                 host, ticket_price_info, booking_info, status, label, verified_at,
                 verification_invalidated_at, created_at, updated_at`;

    const result = await pool.query(sql, updateValues);
    const isOwner = result.rows[0].promoter_id === req.user.id;

    res.json({
      success: true,
      message: materialChanged ? "Event updated; verification reset pending admin review" : "Event updated",
      event: publicEvent(result.rows[0], isOwner),
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/events/:id/cancel — promoter cancels own event (keeps the record)
router.patch("/:id/cancel", authenticate, requireRole("promoter"), async (req, res, next) => {
  try {
    const existing = await pool.query(
      `SELECT promoter_id, status FROM echoroom.events WHERE id = $1`,
      [req.params.id]
    );

    const row = existing.rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    if (row.promoter_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "You can only cancel your own events" });
    }

    if (row.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Event is already cancelled" });
    }

    const result = await pool.query(
      `UPDATE echoroom.events SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1
       RETURNING id, promoter_id, status, updated_at`,
      [req.params.id]
    );

    res.json({
      success: true,
      message: "Event cancelled",
      event: {
        id: result.rows[0].id,
        promoter_id: result.rows[0].promoter_id,
        status: result.rows[0].status,
        updated_at: result.rows[0].updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/events/archive — cancelled and expired events (public archive view)
router.get("/archive", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.promoter_id, e.title, e.description, e.artists, e.venue, e.city,
              e.start_at, e.end_at, e.host, e.ticket_price_info, e.booking_info,
              e.status, e.label, e.verified_at, e.verification_invalidated_at,
              e.created_at, e.updated_at
       FROM echoroom.events e
       WHERE e.status IN ('archived', 'cancelled')
          OR e.start_at <= NOW()
       ORDER BY e.start_at DESC`
    );

    res.json({ success: true, events: result.rows.map((row) => publicEvent(row, false)) });
  } catch (error) {
    next(error);
  }
});

export default router;
