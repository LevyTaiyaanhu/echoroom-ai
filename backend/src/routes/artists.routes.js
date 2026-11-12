import { Router } from "express";
import { pool } from "../config/db.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import multer from "multer";
import { env } from "../config/env.js";

const router = Router();

const artistUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSize, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only image files (JPEG, PNG, WEBP, GIF) are allowed"), false);
    }
    cb(null, true);
  },
});

const uploadArtistPicture = artistUpload.single("profile_picture");

function publicArtistProfile(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    stage_name: row.stage_name,
    genre: row.genre,
    bio: row.bio,
    city: row.city,
    profile_picture_url: row.profile_picture_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function ownerArtistProfile(profileRow, userRow) {
  return {
    id: profileRow.id,
    user_id: profileRow.user_id,
    stage_name: profileRow.stage_name,
    genre: profileRow.genre,
    bio: profileRow.bio,
    city: profileRow.city,
    profile_picture_url: profileRow.profile_picture_url,
    is_private: profileRow.is_private,
    email: userRow.email,
    full_name: userRow.full_name,
    created_at: profileRow.created_at,
    updated_at: profileRow.updated_at,
  };
}

router.post("/me", authenticate, requireRole("artist"), async (req, res, next) => {
  try {
    const { stage_name, genre, bio, city, is_private } = req.body;

    if (!stage_name || typeof stage_name !== "string") {
      return res.status(400).json({ success: false, message: "stage_name is required" });
    }
    const trimmed = stage_name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      return res.status(400).json({ success: false, message: "stage_name must be 2-100 characters" });
    }

    const existing = await pool.query(
      "SELECT id FROM echoroom.artist_profiles WHERE user_id = $1",
      [req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Artist profile already exists" });
    }

    const result = await pool.query(
      `INSERT INTO echoroom.artist_profiles
        (user_id, stage_name, genre, bio, city, is_private)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, stage_name, genre, bio, city, profile_picture_url, is_private, created_at, updated_at`,
      [req.user.id, trimmed, genre ?? null, bio ?? null, city ?? null, is_private === true]
    );

    const userResult = await pool.query(
      "SELECT email, full_name FROM echoroom.users WHERE id = $1",
      [req.user.id]
    );

    res.status(201).json({
      success: true,
      message: "Artist profile created",
      artist: ownerArtistProfile(result.rows[0], userResult.rows[0]),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticate, requireRole("artist"), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ap.id, ap.user_id, ap.stage_name, ap.genre, ap.bio, ap.city,
              ap.profile_picture_url, ap.is_private, ap.created_at, ap.updated_at,
              u.email, u.full_name
       FROM echoroom.artist_profiles ap
       JOIN echoroom.users u ON u.id = ap.user_id
       WHERE ap.user_id = $1`,
      [req.user.id]
    );

    const profile = result.rows[0];
    if (!profile) {
      return res.status(404).json({ success: false, message: "Artist profile not found" });
    }

    res.json({ success: true, artist: ownerArtistProfile(profile, profile) });
  } catch (error) {
    next(error);
  }
});

router.put("/me", authenticate, requireRole("artist"), async (req, res, next) => {
  try {
    const { stage_name, genre, bio, city, is_private } = req.body;

    const updateFields = [];
    const updateValues = [];
    let paramIdx = 1;

    const setField = (field, value) => {
      updateFields.push(`${field} = $${paramIdx++}`);
      updateValues.push(value);
    };

    if (stage_name !== undefined) {
      if (typeof stage_name !== "string" || stage_name.trim().length < 2 || stage_name.trim().length > 100) {
        return res.status(400).json({ success: false, message: "stage_name must be 2-100 characters" });
      }
      setField("stage_name", stage_name.trim());
    }
    if (genre !== undefined) {
      setField("genre", genre ?? null);
    }
    if (bio !== undefined) {
      setField("bio", bio ?? null);
    }
    if (city !== undefined) {
      setField("city", city ?? null);
    }
    if (is_private !== undefined) {
      setField("is_private", Boolean(is_private));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    updateValues.push(req.user.id);
    const sql = `UPDATE echoroom.artist_profiles SET ${updateFields.join(", ")}
       WHERE user_id = $${paramIdx}
       RETURNING id, user_id, stage_name, genre, bio, city, profile_picture_url, is_private, created_at, updated_at`;

    const result = await pool.query(sql, updateValues);
    const profile = result.rows[0];
    if (!profile) {
      return res.status(404).json({ success: false, message: "Artist profile not found" });
    }

    const userResult = await pool.query(
      "SELECT email, full_name FROM echoroom.users WHERE id = $1",
      [req.user.id]
    );

    res.json({
      success: true,
      message: "Artist profile updated",
      artist: ownerArtistProfile(profile, userResult.rows[0]),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { q, genre, city } = req.query;
    const params = [];
    let sql = `
      SELECT ap.id, ap.user_id, ap.stage_name, ap.genre, ap.bio, ap.city,
             ap.profile_picture_url, ap.created_at, ap.updated_at
      FROM echoroom.artist_profiles ap
      JOIN echoroom.users u ON u.id = ap.user_id
      WHERE ap.is_private = FALSE
    `;

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (ap.stage_name ILIKE $${params.length} OR ap.city ILIKE $${params.length})`;
    }
    if (genre) {
      params.push(`%${genre}%`);
      sql += ` AND ap.genre ILIKE $${params.length}`;
    }
    if (city) {
      params.push(city);
      sql += ` AND ap.city = $${params.length}`;
    }

    sql += ` ORDER BY ap.created_at DESC`;

    const result = await pool.query(sql, params);
    res.json({ success: true, artists: result.rows.map(publicArtistProfile) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ap.id, ap.user_id, ap.stage_name, ap.genre, ap.bio, ap.city,
              ap.profile_picture_url, ap.created_at, ap.updated_at
       FROM echoroom.artist_profiles ap
       JOIN echoroom.users u ON u.id = ap.user_id
       WHERE ap.id = $1 AND ap.is_private = FALSE`,
      [req.params.id]
    );

    const profile = result.rows[0];
    if (!profile) {
      return res.status(404).json({ success: false, message: "Artist not found" });
    }

    res.json({ success: true, artist: publicArtistProfile(profile) });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/me/picture",
  authenticate,
  requireRole("artist"),
  uploadArtistPicture,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No image uploaded. Provide the image in the 'profile_picture' field." });
      }

      const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      const result = await pool.query(
        `UPDATE echoroom.artist_profiles
          SET profile_picture_url = $1
         WHERE user_id = $2
         RETURNING id, user_id, profile_picture_url`,
        [dataUrl, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Artist profile not found" });
      }

      res.json({
        success: true,
        message: "Profile picture uploaded",
        profile_picture_url: result.rows[0].profile_picture_url,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete("/me/picture", authenticate, requireRole("artist"), async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE echoroom.artist_profiles
        SET profile_picture_url = NULL
       WHERE user_id = $1
       RETURNING id`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Artist profile not found" });
    }

    res.json({ success: true, message: "Profile picture removed" });
  } catch (error) {
    next(error);
  }
});

export default router;
