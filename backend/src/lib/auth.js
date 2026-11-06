
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
export function signToken(payload, expiresIn = env.jwtExpiresIn) {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(payload, env.jwtSecret, { expiresIn });
}

// Verify JWT token
export function verifyToken(token) {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.verify(token, env.jwtSecret);
}

// Extract token from Authorization header
export function tokenFromRequest(req) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7);
}

// Return public user information
export const publicUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
});
