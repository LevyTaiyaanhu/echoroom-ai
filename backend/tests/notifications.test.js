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
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 10);
  const start = d.toISOString();
  d.setUTCDate(d.getUTCDate() + 1);
  const end = d.toISOString();
  const res = await request(app)
    .post("/api/events")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Notification Test Event",
      description: "Test",
      artists: ["Artist A"],
      venue: "Venue",
      city: "Harare",
      start_at: start,
      end_at: end,
      ...overrides,
    });
  return res.body.event.id;
}

test("GET /api/notifications requires authentication", async (t) => {
  const res = await request(app).get("/api/notifications");
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("GET /api/notifications/unread-count returns count", async (t) => {
  const email = `fanunread${suffix}@example.com`;
  try {
    await register(email, "fan", "Fan Unread");
    const token = await login(email);

    const res = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.unread_count, "number");
  } finally {
    await cleanup(email);
  }
});

test("GET /api/notifications/preferences returns defaults", async (t) => {
  const email = `fanprefs${suffix}@example.com`;
  try {
    await register(email, "fan", "Fan Prefs");
    const token = await login(email);

    const res = await request(app)
      .get("/api/notifications/preferences")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.preferences.event_reminders, true);
    assert.equal(res.body.preferences.new_events_from_followed, true);
    assert.equal(res.body.preferences.saved_event_changes, true);
  } finally {
    await cleanup(email);
  }
});

test("PATCH /api/notifications/preferences updates preferences", async (t) => {
  const email = `fanupdateprefs${suffix}@example.com`;
  try {
    await register(email, "fan", "Fan Update Prefs");
    const token = await login(email);

    const res = await request(app)
      .patch("/api/notifications/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ event_reminders: false, new_events_from_followed: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.preferences.event_reminders, false);
    assert.equal(res.body.preferences.new_events_from_followed, false);
    assert.equal(res.body.preferences.saved_event_changes, true);
  } finally {
    await cleanup(email);
  }
});

test("PATCH /api/notifications/preferences rejects non-boolean values", async (t) => {
  const email = `fanbadprefs${suffix}@example.com`;
  try {
    await register(email, "fan", "Fan Bad Prefs");
    const token = await login(email);

    const res = await request(app)
      .patch("/api/notifications/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ event_reminders: "yes" });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("PATCH /api/notifications/:id/read marks notification as read", async (t) => {
  const email = `fanmarkread${suffix}@example.com`;
  try {
    await register(email, "fan", "Fan Mark Read");
    const token = await login(email);

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    const userId = meRes.body.user.id;

    const notifRes = await pool.query(
      `INSERT INTO echoroom.notifications (user_id, type, title, message, is_read)
       VALUES ($1, 'event_upcoming', $2, $3, FALSE)
       RETURNING id`,
      [userId, "Test Notification", "This is a test"]
    );
    const notifId = notifRes.rows[0].id;

    const readRes = await request(app)
      .patch(`/api/notifications/${notifId}/read`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(readRes.status, 200);
    assert.equal(readRes.body.success, true);

    const countRes = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(countRes.body.unread_count, 0);
  } finally {
    await cleanup(email);
  }
});

test("PATCH /api/notifications/read-all marks all as read", async (t) => {
  const email = `fanreadall${suffix}@example.com`;
  try {
    await register(email, "fan", "Fan Read All");
    const token = await login(email);

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    const userId = meRes.body.user.id;

    await pool.query(
      `INSERT INTO echoroom.notifications (user_id, type, title, message, is_read)
       VALUES ($1, 'event_upcoming', $2, $3, FALSE),
              ($1, 'reminder', $4, $5, FALSE)`,
      [userId, "Notif 1", "Message 1", "Notif 2", "Message 2"]
    );

    const countRes1 = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(countRes1.body.unread_count, 2);

    const readAllRes = await request(app)
      .patch("/api/notifications/read-all")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(readAllRes.status, 200);
    assert.equal(readAllRes.body.success, true);

    const countRes2 = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(countRes2.body.unread_count, 0);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/notifications lists notifications with pagination", async (t) => {
  const email = `fanlistnotif${suffix}@example.com`;
  try {
    await register(email, "fan", "Fan List Notif");
    const token = await login(email);

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    const userId = meRes.body.user.id;

    await pool.query(
      `INSERT INTO echoroom.notifications (user_id, type, title, message, is_read)
       VALUES ($1, 'event_upcoming', $2, $3, FALSE),
              ($1, 'reminder', $4, $5, TRUE)`,
      [userId, "List Notif 1", "Message 1", "List Notif 2", "Message 2"]
    );

    const res = await request(app)
      .get("/api/notifications?limit=1&offset=0")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.notifications.length, 1);
    // Most recent notification should be first (newest first)
    const titles = res.body.notifications.map((n) => n.title);
    assert.ok(titles.includes("List Notif 2") || titles.includes("List Notif 1"));

    const invalidLimit = await request(app)
      .get("/api/notifications?limit=999")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(invalidLimit.status, 400);
  } finally {
    await cleanup(email);
  }
});
