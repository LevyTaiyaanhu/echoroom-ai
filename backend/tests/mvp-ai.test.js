import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../src/app.js";
import { pool } from "../src/config/db.js";

process.env.JWT_SECRET = "test-secret-do-not-use-in-production";

const suffix = Date.now();

async function register(email, role, fullName = "Test User") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ full_name: fullName, email, password: "Password123", role });
  return res;
}

async function login(email) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "Password123" });
  return res.body.token;
}

async function cleanup(email) {
  await pool.query(`DELETE FROM echoroom.users WHERE email = $1`, [email]).catch(() => {});
}

async function createEvent(token, overrides = {}) {
  const future = (days) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
  };
  const res = await request(app)
    .post("/api/events")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "MVP AI Event",
      description: "Test",
      artists: ["Artist A"],
      venue: "Venue",
      city: "Harare",
      start_at: future(10),
      end_at: future(11),
      ...overrides,
    });
  return res.body.event.id;
}

test("POST /api/ai/extract-flyer requires promoter role", async (t) => {
  const email = `mvaifa${suffix}@example.com`;
  try {
    await register(email, "fan", "MVP AI Fan");
    const token = await login(email);

    const res = await request(app)
      .post("/api/ai/extract-flyer")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/ai/extract-flyer returns 400 when no image uploaded", async (t) => {
  const email = `mvaifanopromo${suffix}@example.com`;
  try {
    await register(email, "promoter", "MVP AI Promo No File");
    const token = await login(email);

    const res = await request(app)
      .post("/api/ai/extract-flyer")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/ai/detect-duplicates requires title", async (t) => {
  const email = `mvada${suffix}@example.com`;
  try {
    await register(email, "fan", "MVP Dup Fan");
    const token = await login(email);

    const res = await request(app)
      .post("/api/ai/detect-duplicates")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/ai/detect-duplicates returns empty when no matches", async (t) => {
  const email = `mvada2${suffix}@example.com`;
  try {
    await register(email, "fan", "MVP Dup Fan 2");
    const token = await login(email);

    const res = await request(app)
      .post("/api/ai/detect-duplicates")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Nonexistent Event Title XYZ" });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepStrictEqual(res.body.duplicates, []);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/ai/generate-description requires promoter role", async (t) => {
  const email = `mvagd${suffix}@example.com`;
  try {
    await register(email, "fan", "MVP Gen Desc Fan");
    const token = await login(email);

    const res = await request(app)
      .post("/api/ai/generate-description")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Test Event" });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/ai/generate-description requires title", async (t) => {
  const email = `mvagd2${suffix}@example.com`;
  try {
    await register(email, "promoter", "MVP Gen Desc Promo");
    const token = await login(email);

    const res = await request(app)
      .post("/api/ai/generate-description")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/ai/extract-flyer validates image file type", async (t) => {
  const email = `mvaifile${suffix}@example.com`;
  try {
    await register(email, "promoter", "MVP AI File Promo");
    const token = await login(email);

    const res = await request(app)
      .post("/api/ai/extract-flyer")
      .set("Authorization", `Bearer ${token}`)
      .attach("flyer", Buffer.from("not an image"), "document.txt");
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});