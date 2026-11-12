import { Router } from "express";
import { pool } from "../config/db.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

function followedArtist(row) {
  return {
    id: row.id,
    type: "artist",
    artist_id: row.artist_id,
    user_id: row.user_id,
    stage_name: row.stage_name,
    genre: row.genre,
    city: row.city,
    profile_picture_url: row.profile_picture_url,
    followed_at: row.created_at,
  };
}

function followedPromoter(row) {
  return {
    id: row.id,
    type: "promoter",
    promoter_id: row.promoter_id,
    user_id: row.user_id,
    display_name: row.display_name,
    city: row.city,
    followed_at: row.created_at,
  };
}

router.post("/artists/:id/follow", authenticate, async (req, res, next) => {
  try {
    const artistResult = await pool.query(
      "SELECT ap.id FROM echoroom.artist_profiles ap JOIN echoroom.users u ON u.id = ap.user_id WHERE ap.id = $1",
      [req.params.id]
    );

    if (artistResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Artist not found" });
    }

    const artistId = artistResult.rows[0].id;

    const ownProfile = await pool.query(
      "SELECT id FROM echoroom.artist_profiles WHERE user_id = $1",
      [req.user.id]
    );
    if (ownProfile.rows.some((row) => row.id === artistId)) {
      return res.status(400).json({ success: false, message: "You cannot follow yourself" });
    }

    await pool.query(
      `INSERT INTO echoroom.artist_follows (follower_id, artist_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, artist_id) DO NOTHING`,
      [req.user.id, artistId]
    );

    res.json({ success: true, message: "Following artist" });
  } catch (error) {
    next(error);
  }
});

router.delete("/artists/:id/follow", authenticate, async (req, res, next) => {
  try {
    const artistResult = await pool.query(
      "SELECT id FROM echoroom.artist_profiles WHERE id = $1",
      [req.params.id]
    );

    if (artistResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Artist not found" });
    }

    await pool.query(
      "DELETE FROM echoroom.artist_follows WHERE follower_id = $1 AND artist_id = $2",
      [req.user.id, artistResult.rows[0].id]
    );

    res.json({ success: true, message: "Unfollowed artist" });
  } catch (error) {
    next(error);
  }
});

router.get("/following", authenticate, async (req, res, next) => {
  try {
    const followedArtists = await pool.query(
      `SELECT af.id, af.artist_id, af.created_at,
              ap.user_id, ap.stage_name, ap.genre, ap.city, ap.profile_picture_url
       FROM echoroom.artist_follows af
       JOIN echoroom.artist_profiles ap ON ap.id = af.artist_id
       WHERE af.follower_id = $1
       ORDER BY af.created_at DESC`,
      [req.user.id]
    );

    const followedPromoters = await pool.query(
      `SELECT pf.id, pf.promoter_id, pf.created_at,
              pp.user_id, pp.display_name, pp.city
       FROM echoroom.promoter_follows pf
       JOIN echoroom.promoter_profiles pp ON pp.id = pf.promoter_id
       WHERE pf.follower_id = $1
       ORDER BY pf.created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      following: {
        artists: followedArtists.rows.map(followedArtist),
        promoters: followedPromoters.rows.map(followedPromoter),
        counts: {
          artists: followedArtists.rows.length,
          promoters: followedPromoters.rows.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/artists/:id/followers", async (req, res, next) => {
  try {
    const artistResult = await pool.query(
      "SELECT id FROM echoroom.artist_profiles WHERE id = $1",
      [req.params.id]
    );

    if (artistResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Artist not found" });
    }

    const countResult = await pool.query(
      "SELECT COUNT(*) AS count FROM echoroom.artist_follows WHERE artist_id = $1",
      [artistResult.rows[0].id]
    );

    res.json({
      success: true,
      followers: { count: Number(countResult.rows[0].count) },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/following/events", authenticate, async (req, res, next) => {
  try {
    const promoterEvents = await pool.query(
      `SELECT DISTINCT e.id, e.promoter_id, e.title, e.description, e.artists, e.venue, e.city,
              e.start_at, e.end_at, e.host, e.ticket_price_info, e.booking_info,
              e.status, e.label, e.verified_at, e.verification_invalidated_at,
              e.created_at, e.updated_at, e.is_hidden
       FROM echoroom.events e
       JOIN echoroom.promoter_follows pf ON pf.promoter_id IN (
         SELECT pp.id FROM echoroom.promoter_profiles pp WHERE pp.user_id = e.promoter_id
       )
       WHERE pf.follower_id = $1
         AND e.status = 'active'
         AND e.start_at > NOW()
         AND e.is_hidden = FALSE
       ORDER BY e.start_at ASC`,
      [req.user.id]
    );

    const artistEvents = await pool.query(
      `SELECT DISTINCT e.id, e.promoter_id, e.title, e.description, e.artists, e.venue, e.city,
              e.start_at, e.end_at, e.host, e.ticket_price_info, e.booking_info,
              e.status, e.label, e.verified_at, e.verification_invalidated_at,
              e.created_at, e.updated_at, e.is_hidden
       FROM echoroom.events e
       WHERE e.status = 'active'
         AND e.start_at > NOW()
         AND e.is_hidden = FALSE
         AND EXISTS (
           SELECT 1 FROM echoroom.artist_follows af
           JOIN echoroom.artist_profiles ap ON ap.id = af.artist_id
           WHERE af.follower_id = $1
             AND ap.stage_name = ANY(e.artists)
         )
       ORDER BY e.start_at ASC`,
      [req.user.id]
    );

    const seen = new Set();
    const merged = [];
    for (const row of [...promoterEvents.rows, ...artistEvents.rows]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        merged.push(row);
      }
    }
    merged.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

    function publicEvent(row) {
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
      };
    }

    res.json({ success: true, events: merged.map(publicEvent) });
  } catch (error) {
    next(error);
  }
});

export default router;
