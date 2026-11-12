
import { Router } from "express";
import { pool } from "../config/db.js";

import {
  hashPassword,
  comparePassword,
  signToken,
  publicUser,
} from "../lib/auth.js";

import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Validate email format
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// REGISTER
router.post("/register", async (req, res, next) => {
  try {
    const body =
      typeof req.body === "object" && req.body !== null
        ? req.body
        : {};

    const { full_name, email, password, role } = body;

    if (!full_name || typeof full_name !== "string") {
      return res.status(400).json({
        success: false,
        message: "Full name is required",
      });
    }

    const trimmedName = full_name.trim();

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Full name must be between 2 and 100 characters",
      });
    }

    if (
      !email ||
      typeof email !== "string" ||
      !validateEmail(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (
      !password ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    if (role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Public registration cannot assign the admin role",
      });
    }

    const userRole = role === "promoter" || role === "artist" ? role : "fan";

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO echoroom.users
        (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role`,
      [trimmedName, normalizedEmail, passwordHash, userRole]
    );

    const user = result.rows[0];

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: publicUser(user),
      token,
    });

  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    next(error);
  }
});

// LOGIN
router.post("/login", async (req, res, next) => {
  try {
    const body =
      typeof req.body === "object" && req.body !== null
        ? req.body
        : {};

    const { email, password } = body;

    if (
      !email ||
      typeof email !== "string" ||
      !password ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!validateEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role
       FROM echoroom.users
       WHERE email = $1`,
      [normalizedEmail]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordValid = await comparePassword(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: publicUser(user),
      token,
    });

  } catch (error) {
    next(error);
  }
});

// GET CURRENT USER
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role
       FROM echoroom.users
       WHERE id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: publicUser(user),
    });

  } catch (error) {
    next(error);
  }
});

export default router;
