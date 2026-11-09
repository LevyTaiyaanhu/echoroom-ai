import { Router } from "express";
import { pool } from "../config/db.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

function publicProfile(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    display_name: row.display_name,
    bio: row.bio,
    city: row.city,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Public: list/search promoters
router.get("/", async (req, res, next) => {
  try {
    const { q, city } = req.query;
    let params = [];
    let sql = `
      SELECT pp.id, pp.user_id, pp.display_name, pp.bio, pp.city, pp.created_at, pp.updated_at
      FROM echoroom.promoter_profiles pp
      JOIN echoroom.users u ON u.id = pp.user_id
      WHERE u.role = 'promoter'
    `;

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (pp.display_name ILIKE $${params.length} OR pp.city ILIKE $${params.length})`;
    }
    if (city) {
      params.push(city);
      sql += ` AND pp.city = $${params.length}`;
    }

    sql += ` ORDER BY pp.created_at DESC`;

    const result = await pool.query(sql, params);
    res.json({ success: true, promoters: result.rows.map(publicProfile) });
  } catch (error) {
    next(error);
  }
});

// Public: promoter profile detail
router.get("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT pp.id, pp.user_id, pp.display_name, pp.bio, pp.city, pp.created_at, pp.updated_at
       FROM echoroom.promoter_profiles pp
       JOIN echoroom.users u ON u.id = pp.user_id
       WHERE pp.id = $1 AND u.role = 'promoter'`,
      [req.params.id]
    );

    const profile = result.rows[0];
    if (!profile) {
      return res.status(404).json({ success: false, message: "Promoter not found" });
    }

    res.json({ success: true, promoter: publicProfile(profile) });
  } catch (error) {
    next(error);
  }
});

// Authenticated promoter: edit own profile (upsert)
router.put("/me", authenticate, requireRole("promoter"), async (req, res, next) => {
  try {
    const { display_name, bio, city } = req.body;

    if (display_name === undefined) {
      return res.status(400).json({ success: false, message: "display_name is required" });
    }
    if (typeof display_name !== "string" || display_name.trim().length < 2 || display_name.trim().length > 100) {
      return res.status(400).json({ success: false, message: "display_name must be 2-100 characters" });
    }
    if (bio !== undefined && bio !== null && typeof bio !== "string") {
      return res.status(400).json({ success: false, message: "bio must be a string" });
    }
    if (bio !== null && bio !== undefined && bio.length > 2000) {
      return res.status(400).json({ success: false, message: "bio must be at most 2000 characters" });
    }
    if (city !== undefined && city !== null && (!city || city.trim().length > 100)) {
      return res.status(400).json({ success: false, message: "city must be at most 100 characters" });
    }

    const result = await pool.query(
      `INSERT INTO echoroom.promoter_profiles (user_id, display_name, bio, city)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = COALESCE(EXCLUDED.display_name, promoter_profiles.display_name),
         bio = COALESCE(EXCLUDED.bio, promoter_profiles.bio),
         city = COALESCE(EXCLUDED.city, promoter_profiles.city),
         updated_at = NOW()
       RETURNING id, user_id, display_name, bio, city, created_at, updated_at`,
      [req.user.id, display_name ?? null, bio ?? null, city ?? null]
    );

    res.json({ success: true, promoter: publicProfile(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});


// GET /api/promoters/me/events - the authenticated promoter own events
router.get("/me/events", authenticate, requireRole("promoter"), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, promoter_id, title, description, artists, venue, city,
              start_at, end_at, host, ticket_price_info, booking_info,
              status, label, verified_at, verification_invalidated_at,
              created_at, updated_at, is_hidden
       FROM echoroom.events
       WHERE promoter_id = $1
       ORDER BY start_at ASC`
      [req.user.id]
    );

    res.json({ success: true, events: result.rows.map((row) => publicEvent(row, true)) });
  } catch (error) {
    next(error);
  }
});


// GET /api/promoters/me/followers - promoter follower count
router.get("/me/followers", authenticate, requireRole("promoter"), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS count
       FROM echoroom.promoter_follows
       WHERE promoter_id = $1`
      [req.user.id]
    );

    res.json({
      success: true,
      followers: { count: Number(result.rows[0].count) },
    });
  } catch (error) {
    next(error);
  }
});


// Authenticated: follow a promoter
router.post("/:id/follow", authenticate, async (req, res, next) => {
  try {
    const promoterResult = await pool.query(
      `SELECT pp.id FROM echoroom.promoter_profiles pp
       JOIN echoroom.users u ON u.id = pp.user_id
       WHERE pp.id = $1 AND u.role = 'promoter'`,
      [req.params.id]
    );

    if (promoterResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Promoter not found" });
    }

    const promoterId = promoterResult.rows[0].id;
    if (promoterId === req.user.id) {
      // Compare promoter profile id against user id loosely; a promoter follows a profile,
      // so self-follow means the profile belongs to the authenticated user.
      const ownResult = await pool.query(
        `SELECT id FROM echoroom.promoter_profiles WHERE user_id = $1`,
        [req.user.id]
      );
      if (ownResult.rows.some((row) => row.id === promoterId)) {
        return res.status(400).json({ success: false, message: "You cannot follow yourself" });
      }
    }

    await pool.query(
      `INSERT INTO echoroom.promoter_follows (follower_id, promoter_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, promoter_id) DO NOTHING`,
      [req.user.id, promoterId]
    );

    res.json({ success: true, message: "Following promoter" });
  } catch (error) {
    next(error);
  }
});

// Authenticated: unfollow a promoter
router.delete("/:id/follow", authenticate, async (req, res, next) => {
  try {
    const promoterResult = await pool.query(
      `SELECT pp.id FROM echoroom.promoter_profiles pp
       JOIN echoroom.users u ON u.id = pp.user_id
       WHERE pp.id = $1 AND u.role = 'promoter'`,
      [req.params.id]
    );

    if (promoterResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Promoter not found" });
    }

    await pool.query(
      `DELETE FROM echoroom.promoter_follows
       WHERE follower_id = $1 AND promoter_id = $2`,
      [req.user.id, promoterResult.rows[0].id]
    );

    res.json({ success: true, message: "Unfollowed promoter" });
  } catch (error) {
    next(error);
  }
});

export default router;