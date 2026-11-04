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

async function registerAsPromoter(email, fullName = "Promoter") {
  await request(app)
    .post("/api/auth/register")
    .send({ full_name: fullName, email, password: "Password123", role: "promoter" });
}

async function login(email) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "Password123" });
  return res.body.token;
}

async function createEvent(token, overrides = {}) {
  const start = future(10);
  const end = future(11);
  const res = await request(app)
    .post("/api/events")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Harare Music Festival",
      description: "A great music event",
      artists: ["Artist A", "Artist B"],
      venue: "Star Amphitheatre",
      city: "Harare",
      start_at: start,
      end_at: end,
      host: "DJ Maphorisa",
      ticket_price_info: "$10-$20",
      booking_info: "WhatsApp bookings",
      ...overrides,
    });
  return res;
}

async function cleanup(email) {
  await pool.query(`DELETE FROM echoroom.users WHERE email = $1`, [email]).catch(() => {});
}

test("POST /api/events requires authentication", async (t) => {
  const res = await request(app).post("/api/events").send({ title: "X" });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("POST /api/events requires promoter role", async (t) => {
  const email = `fanevt${suffix}@example.com`;
  try {
    await request(app)
      .post("/api/auth/register")
      .send({ full_name: "Fan", email: email, password: "Password123", role: "fan" });
    const token = await login(email);
    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "X", venue: "Y", city: "Z", start_at: future(1), end_at: future(2), artists: ["A"] });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/events creates an event for a promoter", async (t) => {
  const email = `promoterevt${suffix}@example.com`;
  try {
    await registerAsPromoter(email, "Event Promoter");
    const token = await login(email);
    const res = await createEvent(token);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.event.title, "Harare Music Festival");
    assert.equal(res.body.event.status, "active");
    assert.equal(res.body.event.label, "posted_by_promoter");
    assert.ok(res.body.event.id);
    assert.ok(res.body.event.start_at);
    assert.ok(res.body.event.end_at);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/events validates required fields and times", async (t) => {
  const email = `promoterval${suffix}@example.com`;
  try {
    await registerAsPromoter(email, "Val Promoter");
    const token = await login(email);

    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "",
        venue: "V",
        city: "C",
        start_at: future(2),
        end_at: future(1),
        artists: [],
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.message.length > 0);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/events lists active non-expired events", async (t) => {
  const email = `promoterlist${suffix}@example.com`;
  try {
    await registerAsPromoter(email, "List Promoter");
    const token = await login(email);
    await createEvent(token);
    await createEvent(token, { title: "Bulawayo Jazz Night", city: "Bulawayo" });

    const res = await request(app).get("/api/events");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.events));
    assert.ok(res.body.events.length >= 2);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/events/:id returns event detail", async (t) => {
  const email = `promoterdetail${suffix}@example.com`;
  try {
    await registerAsPromoter(email, "Detail Promoter");
    const token = await login(email);
    const created = await createEvent(token);
    const eventId = created.body.event.id;

    const res = await request(app).get(`/api/events/${eventId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.event.id, eventId);
    assert.equal(res.body.event.title, "Harare Music Festival");
    assert.equal(res.body.event.password_hash, undefined);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/events/:id returns 404 for unknown event", async (t) => {
  const res = await request(app).get("/api/events/00000000-0000-0000-0000-000000000000");
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test("PUT /api/events/:id allows the owning promoter to edit their event", async (t) => {
  const email = `promoteredt${suffix}@example.com`;
  try {
    await registerAsPromoter(email, "Edit Promoter");
    const token = await login(email);
    const created = await createEvent(token);
    const eventId = created.body.event.id;

    const res = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Updated Harare Festival",
        artists: ["Artist A", "Artist B"],
        venue: "Star Amphitheatre",
        city: "Harare",
        start_at: future(10),
        end_at: future(11),
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.event.title, "Updated Harare Festival");
  } finally {
    await cleanup(email);
  }
});

test("PUT /api/events/:id material change resets verification label", async (t) => {
  const email = `promotervef${suffix}@example.com`;
  try {
    await registerAsPromoter(email, "Verif Promoter");
    const token = await login(email);
    const created = await createEvent(token);
    const eventId = created.body.event.id;

    // Simulate admin verification by directly updating the DB
    await pool.query(
      `UPDATE echoroom.events SET label = 'verified', verified_at = NOW(), verified_by = $1 WHERE id = $2`,
      [null, eventId]
    );

    const res = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Materially Changed Title",
        artists: ["Artist A", "Artist B"],
        venue: "Star Amphitheatre",
        city: "Harare",
        start_at: future(10),
        end_at: future(11),
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.event.label, "posted_by_promoter");
    assert.equal(res.body.event.verification_invalidated_at !== null, true);
  } finally {
    await cleanup(email);
  }
});

test("PUT /api/events/:id rejects another promoter editing the event", async (t) => {
  const emailA = `promotera${suffix}@example.com`;
  const emailB = `promoterb${suffix}@example.com`;
  try {
    await registerAsPromoter(emailA, "Promoter A");
    await registerAsPromoter(emailB, "Promoter B");
    const tokenA = await login(emailA);
    const tokenB = await login(emailB);
    const created = await createEvent(tokenA);
    const eventId = created.body.event.id;

    const res = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ title: "Hacked Title" });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(emailA);
    await cleanup(emailB);
  }
});

test("POST /api/events rejects fan from creating events", async (t) => {
  const email = `fancreate${suffix}@example.com`;
  try {
    await request(app)
      .post("/api/auth/register")
      .send({ full_name: "Fan", email: email, password: "Password123", role: "fan" });
    const token = await login(email);
    const res = await createEvent(token);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("PATCH /api/events/:id/cancel cancels the event without deleting it", async (t) => {
  const email = `promotercan${suffix}@example.com`;
  try {
    await registerAsPromoter(email, "Cancel Promoter");
    const token = await login(email);
    const created = await createEvent(token);
    const eventId = created.body.event.id;

    const res = await request(app)
      .patch(`/api/events/${eventId}/cancel`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.event.status, "cancelled");

    // The record still exists
    const detail = await request(app).get(`/api/events/${eventId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.event.status, "cancelled");
  } finally {
    await cleanup(email);
  }
});

test("PATCH /api/events/:id/cancel rejects cancelling another promoter's event", async (t) => {
  const emailA = `promotercana${suffix}@example.com`;
  const emailB = `promotercanb${suffix}@example.com`;
  try {
    await registerAsPromoter(emailA, "Cancel A");
    await registerAsPromoter(emailB, "Cancel B");
    const tokenA = await login(emailA);
    const tokenB = await login(emailB);
    const created = await createEvent(tokenA);
    const eventId = created.body.event.id;

    const res = await request(app)
      .patch(`/api/events/${eventId}/cancel`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(emailA);
    await cleanup(emailB);
  }
});

test("GET /api/events/archive includes cancelled and expired events", async (t) => {
  const email = `promoterarch${suffix}@example.com`;
  try {
    await registerAsPromoter(email, "Archive Promoter");
    const token = await login(email);

    await createEvent(token, { title: "Future Active Event" });

    const pastStart = future(-5);
    const pastEnd = future(-4);
    await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Expired Past Event",
        artists: ["Old Artist"],
        venue: "Old Venue",
        city: "Harare",
        start_at: pastStart,
        end_at: pastEnd,
      });

    const created = await createEvent(token, { title: "To Be Cancelled" });
    const eventId = created.body.event.id;
    await request(app)
      .patch(`/api/events/${eventId}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app).get("/api/events/archive");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const titles = res.body.events.map((e) => e.title);
    assert.ok(titles.includes("Expired Past Event"));
    assert.ok(titles.includes("To Be Cancelled"));
    assert.ok(!titles.includes("Future Active Event"));
  } finally {
    await cleanup(email);
  }
});