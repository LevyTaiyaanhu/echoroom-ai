import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../src/app.js";
import { pool } from "../src/config/db.js";

process.env.JWT_SECRET = "test-secret-do-not-use-in-production";

const suffix = Date.now();

const future = (days) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
};

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
  const res = await request(app)
    .post("/api/events")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Saved Event Test",
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

test("POST /api/events/:id/save requires authentication", async (t) => {
  const res = await request(app).post("/api/events/some-id/save");
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("Save and unsave an event", async (t) => {
  const fanEmail = `fansave${suffix}@example.com`;
  const promoEmail = `promosave${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "Fan Save");
    const fanToken = await login(fanEmail);

    await register(promoEmail, "promoter", "Promoter Save");
    const promoToken = await login(promoEmail);
    const eventId = await createEvent(promoToken);

    const saveRes = await request(app)
      .post(`/api/events/${eventId}/save`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(saveRes.status, 200);
    assert.equal(saveRes.body.success, true);
    assert.equal(saveRes.body.saved_count, 1);

    const duplicateRes = await request(app)
      .post(`/api/events/${eventId}/save`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(duplicateRes.status, 200);
    assert.equal(duplicateRes.body.saved_count, 1);

    const unsaveRes = await request(app)
      .delete(`/api/events/${eventId}/save`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(unsaveRes.status, 200);
    assert.equal(unsaveRes.body.success, true);
    assert.equal(unsaveRes.body.saved_count, 0);
  } finally {
    await cleanup(fanEmail);
    await cleanup(promoEmail);
  }
});

test("GET /api/events/saved returns saved events for authenticated fan", async (t) => {
  const fanEmail = `fansavedlist${suffix}@example.com`;
  const promoEmail = `promosavedlist${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "Fan Saved List");
    const fanToken = await login(fanEmail);

    await register(promoEmail, "promoter", "Promoter Saved List");
    const promoToken = await login(promoEmail);

    const eventId1 = await createEvent(promoToken, { title: "Saved Event 1" });
    const eventId2 = await createEvent(promoToken, { title: "Saved Event 2" });

    await request(app)
      .post(`/api/events/${eventId1}/save`)
      .set("Authorization", `Bearer ${fanToken}`);
    await request(app)
      .post(`/api/events/${eventId2}/save`)
      .set("Authorization", `Bearer ${fanToken}`);

    const res = await request(app)
      .get("/api/events/saved")
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.events.length, 2);
    const titles = res.body.events.map((e) => e.title);
    assert.ok(titles.includes("Saved Event 1"));
    assert.ok(titles.includes("Saved Event 2"));
    // Each saved event should have saved_at
    for (const e of res.body.events) {
      assert.ok(e.saved_at);
    }
  } finally {
    await cleanup(fanEmail);
    await cleanup(promoEmail);
  }
});

test("Save returns 404 for unknown event", async (t) => {
  const email = `fansave404${suffix}@example.com`;
  try {
    await register(email, "fan", "Fan Save 404");
    const token = await login(email);

    const res = await request(app)
      .post("/api/events/00000000-0000-0000-0000-000000000000/save")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("Saves are separate from likes", async (t) => {
  const fanEmail = `fansavelike${suffix}@example.com`;
  const promoEmail = `promosavelike${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "Fan Save Like");
    const fanToken = await login(fanEmail);

    await register(promoEmail, "promoter", "Promoter Save Like");
    const promoToken = await login(promoEmail);
    const eventId = await createEvent(promoToken);

    // Like the event
    await request(app)
      .post(`/api/events/${eventId}/like`)
      .set("Authorization", `Bearer ${fanToken}`);

    // Save the event
    await request(app)
      .post(`/api/events/${eventId}/save`)
      .set("Authorization", `Bearer ${fanToken}`);

    // Check saved events
    const savedRes = await request(app)
      .get("/api/events/saved")
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(savedRes.body.events.length, 1);

    // Unlike the event - save should remain
    await request(app)
      .delete(`/api/events/${eventId}/like`)
      .set("Authorization", `Bearer ${fanToken}`);

    const savedRes2 = await request(app)
      .get("/api/events/saved")
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(savedRes2.body.events.length, 1);
  } finally {
    await cleanup(fanEmail);
    await cleanup(promoEmail);
  }
});
