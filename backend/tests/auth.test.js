import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../src/app.js";
import { pool } from "../src/config/db.js";

// JWT_SECRET is read at call time by src/lib/auth.js; set it for these tests.
process.env.JWT_SECRET = "test-secret-do-not-use-in-production";

const baseEmail = `testuser${Date.now()}@example.com`;

async function registerUser(app, overrides = {}) {
  const email = overrides.email ?? baseEmail;
  const role = overrides.role ?? "fan";
  const res = await request(app)
    .post("/api/auth/register")
    .send({ full_name: "Test User", email, password: "Password123", role });
  return res;
}

async function cleanupUser(email) {
  await pool.query(`DELETE FROM echoroom.users WHERE email = $1`, [email]);
}

test("POST /api/auth/register creates a fan account without returning the password hash", async (t) => {
  const email = `fan${Date.now()}@example.com`;
  try {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ full_name: "Fan User", email, password: "Password123", role: "fan" });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.email, email);
    assert.equal(res.body.user.role, "fan");
    assert.ok(res.body.token);
    assert.equal(res.body.user.password_hash, undefined);
    assert.notEqual(res.body.user.id, undefined);
  } finally {
    await pool.query(`DELETE FROM echoroom.users WHERE email = $1`, [email]).catch(() => {});
  }
});

test("POST /api/auth/register cannot assign the admin role publicly", async (t) => {
  const email = `admin${Date.now()}@example.com`;
  try {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ full_name: "Admin Attempt", email, password: "Password123", role: "admin" });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /admin/i);
  } finally {
    await pool.query(`DELETE FROM echoroom.users WHERE email = $1`, [email]).catch(() => {});
  }
});

test("POST /api/auth/register rejects duplicate email", async (t) => {
  const email = `dup${Date.now()}@example.com`;
  try {
    const first = await request(app)
      .post("/api/auth/register")
      .send({ full_name: "Dup User", email, password: "Password123" });
    assert.equal(first.status, 201);

    const second = await request(app)
      .post("/api/auth/register")
      .send({ full_name: "Dup User 2", email, password: "Password123" });
    assert.equal(second.status, 409);
    assert.equal(second.body.success, false);
  } finally {
    await pool.query(`DELETE FROM echoroom.users WHERE email = $1`, [email]).catch(() => {});
  }
});

test("POST /api/auth/login returns a token for valid credentials", async (t) => {
  const email = `login${Date.now()}@example.com`;
  try {
    await request(app)
      .post("/api/auth/register")
      .send({ full_name: "Login User", email, password: "Password123" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "Password123" });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, email);
    assert.equal(res.body.user.password_hash, undefined);
  } finally {
    await pool.query(`DELETE FROM echoroom.users WHERE email = $1`, [email]).catch(() => {});
  }
});

test("POST /api/auth/login rejects wrong password", async (t) => {
  const email = `wrong${Date.now()}@example.com`;
  try {
    await request(app)
      .post("/api/auth/register")
      .send({ full_name: "Wrong User", email, password: "Password123" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "WrongPassword" });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  } finally {
    await pool.query(`DELETE FROM echoroom.users WHERE email = $1`, [email]).catch(() => {});
  }
});

test("GET /api/auth/me returns current user with valid token", async (t) => {
  const email = `me${Date.now()}@example.com`;
  try {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ full_name: "Me User", email, password: "Password123", role: "promoter" });
    assert.equal(reg.status, 201);
    const token = reg.body.token;

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.email, email);
    assert.equal(res.body.user.role, "promoter");
    assert.equal(res.body.user.password_hash, undefined);
  } finally {
    await pool.query(`DELETE FROM echoroom.users WHERE email = $1`, [email]).catch(() => {});
  }
});

test("GET /api/auth/me returns 401 without a token", async (t) => {
  const res = await request(app).get("/api/auth/me");
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("GET /api/auth/me returns 401 with an invalid token", async (t) => {
  const res = await request(app)
    .get("/api/auth/me")
    .set("Authorization", "Bearer not-a-real-token");
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});