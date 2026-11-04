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

async function registerAsFan(email, fullName = "Fan") {
  await request(app)
    .post("/api/auth/register")
    .send({ full_name: fullName, email, password: "Password123", role: "fan" });
}

async function login(email) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "Password123" });
  return res.body.token;
}

async function createEvent(token, overrides = {}) {
  const res = await request(app)
    .post("/api/events")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Engagement Test Event",
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

async function cleanup(email) {
  await pool.query(`DELETE FROM echoroom.users WHERE email = $1`, [email]).catch(() => {});
}

test("POST /api/events/:id/like requires authentication", async (t) => {
  const res = await request(app).post("/api/events/some-id/like");
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("POST /api/events/:id/like then unlike toggles like count", async (t) => {
  const email = `engfan${suffix}@example.com`;
  try {
    await registerAsFan(email);
    const token = await login(email);
    await registerAsPromoter(`engpromo${suffix}@example.com`);
    const promoToken = await login(`engpromo${suffix}@example.com`);
    const eventId = await createEvent(promoToken);

    const likeRes = await request(app)
      .post(`/api/events/${eventId}/like`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(likeRes.status, 200);
    assert.equal(likeRes.body.success, true);
    assert.equal(likeRes.body.like_count, 1);

    const unlikeRes = await request(app)
      .delete(`/api/events/${eventId}/like`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(unlikeRes.status, 200);
    assert.equal(unlikeRes.body.like_count, 0);
  } finally {
    await cleanup(email);
    await cleanup(`engpromo${suffix}@example.com`);
  }
});

test("POST /api/events/:id/like prevents duplicate likes", async (t) => {
  const fanEmail = `engfan2${suffix}@example.com`;
  const promoEmail = `engpromo2${suffix}@example.com`;
  try {
    await registerAsFan(fanEmail);
    const fanToken = await login(fanEmail);
    await registerAsPromoter(promoEmail);
    const promoToken = await login(promoEmail);
    const eventId = await createEvent(promoToken);

    await request(app)
      .post(`/api/events/${eventId}/like`)
      .set("Authorization", `Bearer ${fanToken}`);

    const countRes = await request(app).get(`/api/events/${eventId}/engagement`);
    assert.equal(countRes.body.engagement.like_count, 1);

    await request(app)
      .post(`/api/events/${eventId}/like`)
      .set("Authorization", `Bearer ${fanToken}`);

    const countRes2 = await request(app).get(`/api/events/${eventId}/engagement`);
    assert.equal(countRes2.body.engagement.like_count, 1);
  } finally {
    await cleanup(fanEmail);
    await cleanup(promoEmail);
  }
});

test("POST /api/events/:id/view increments view count", async (t) => {
  const email = `engview${suffix}@example.com`;
  try {
    await registerAsFan(email);
    const token = await login(email);
    await registerAsPromoter(`engviewpromo${suffix}@example.com`);
    const viewToken = await login(`engviewpromo${suffix}@example.com`);
    const eventId = await createEvent(viewToken);

    const v1 = await request(app).post(`/api/events/${eventId}/view`);
    assert.equal(v1.status, 200);
    assert.equal(v1.body.view_count, 1);

    const v2 = await request(app).post(`/api/events/${eventId}/view`);
    assert.equal(v2.body.view_count, 2);
  } finally {
    await cleanup(email);
    await cleanup(`engviewpromo${suffix}@example.com`);
  }
});

test("POST /api/events/:id/share tracks share count", async (t) => {
  const email = `engshare${suffix}@example.com`;
  try {
    await registerAsFan(email);
    const token = await login(email);
    await registerAsPromoter(`engsharepromo${suffix}@example.com`);
    const shareToken = await login(`engsharepromo${suffix}@example.com`);
    const eventId = await createEvent(shareToken);

    const s1 = await request(app)
      .post(`/api/events/${eventId}/share`)
      .set("Authorization", `Bearer ${token}`)
      .send({ platform: "whatsapp" });
    assert.equal(s1.status, 200);
    assert.equal(s1.body.share_count, 1);

    const eng = await request(app).get(`/api/events/${eventId}/engagement`);
    assert.equal(eng.body.engagement.share_count, 1);
    assert.equal(eng.body.engagement.like_count, 0);
    assert.equal(eng.body.engagement.view_count, 0);
  } finally {
    await cleanup(email);
    await cleanup(`engsharepromo${suffix}@example.com`);
  }
});

test("GET /api/events/:id/engagement returns 404 for unknown event", async (t) => {
  const res = await request(app).get(
    "/api/events/00000000-0000-0000-0000-000000000000/engagement"
  );
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test("GET /api/promoters/me/engagement returns promoter stats", async (t) => {
  const email = `engstats${suffix}@example.com`;
  try {
    await registerAsPromoter(email, "Stats Promoter");
    const token = await login(email);
    await createEvent(token);
    await createEvent(token);

    const res = await request(app)
      .get("/api/promoters/me/engagement")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.engagement.total_events, 2);
    assert.equal(res.body.engagement.active_events, 2);
    assert.equal(res.body.engagement.total_likes, 0);
    assert.equal(res.body.engagement.total_views, 0);
    assert.equal(res.body.engagement.total_shares, 0);
    assert.ok(res.body.engagement.note);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/promoters/me/engagement requires authentication", async (t) => {
  const res = await request(app).get("/api/promoters/me/engagement");
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});