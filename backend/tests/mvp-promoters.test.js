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
      title: "MVP Test Event",
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

async function createPromoterProfile(token, displayName = "Promo Profile") {
  const res = await request(app)
    .put("/api/promoters/me")
    .set("Authorization", `Bearer ${token}`)
    .send({ display_name: displayName });
  return res.body.promoter.id;
}


test("GET /api/promoters/me/events returns the promoter's own events", async (t) => {
  const email = `mvpmeevt${suffix}@example.com`;
  try {
    await register(email, "promoter", "MVP Me Event Promoter");
    const token = await login(email);

    let res = await request(app)
      .get("/api/promoters/me/events")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepStrictEqual(res.body.events, []);

    const eventId1 = await createEvent(token);
    const eventId2 = await createEvent(token, { title: "Second MVP Event" });

    res = await request(app)
      .get("/api/promoters/me/events")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.events.length, 2);
    assert.ok(res.body.events.some((e) => e.id === eventId1));
    assert.ok(res.body.events.some((e) => e.id === eventId2));
    assert.ok(res.body.events[0].can_edit === true);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/promoters/me/events requires promoter role", async (t) => {
  const email = `mvpmefan${suffix}@example.com`;
  try {
    await register(email, "fan", "MVP Fan");
    const token = await login(email);

    const res = await request(app)
      .get("/api/promoters/me/events")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/promoters/me/followers returns follower count", async (t) => {
  const fanEmail = `mvpmefan2${suffix}@example.com`;
  const promoEmail = `mvpmepromo2${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "MVP Fan 2");
    const fanToken = await login(fanEmail);
    const fanMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${fanToken}`);
    const fanId = fanMe.body.user.id;

    await register(promoEmail, "promoter", "MVP Promo 2");
    const promoToken = await login(promoEmail);
    const promoProfileId = await createPromoterProfile(promoToken);

    await request(app)
      .post(`/api/promoters/${promoProfileId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);

    const res = await request(app)
      .get("/api/promoters/me/followers")
      .set("Authorization", `Bearer ${promoToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.followers.count, 1);
    assert.equal(typeof res.body.followers.count, "number");
  } finally {
    await cleanup(fanEmail);
    await cleanup(promoEmail);
  }
});

test("GET /api/promoters/me/followers returns zero when no followers", async (t) => {
  const email = `mvpmezerofollowers${suffix}@example.com`;
  try {
    await register(email, "promoter", "MVP Zero Followers");
    const token = await login(email);
    await createPromoterProfile(token);

    const res = await request(app)
      .get("/api/promoters/me/followers")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.followers.count, 0);
  } finally {
    await cleanup(email);
  }
});

test("Fan can like and unlike an event", async (t) => {
  const fanEmail = `mvplikefan${suffix}@example.com`;
  const promoEmail = `mvplikepromo${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "MVP Like Fan");
    const fanToken = await login(fanEmail);

    await register(promoEmail, "promoter", "MVP Like Promo");
    const promoToken = await login(promoEmail);
    const eventId = await createEvent(promoToken);

    const likeRes = await request(app)
      .post(`/api/events/${eventId}/like`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(likeRes.status, 200);
    assert.equal(likeRes.body.success, true);
    assert.equal(likeRes.body.like_count, 1);

    const unlikeRes = await request(app)
      .delete(`/api/events/${eventId}/like`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(unlikeRes.status, 200);
    assert.equal(unlikeRes.body.success, true);
    assert.equal(unlikeRes.body.like_count, 0);
  } finally {
    await cleanup(fanEmail);
    await cleanup(promoEmail);
  }
});

test("Fan can follow and unfollow a promoter", async (t) => {
  const fanEmail = `mvpfollowfan${suffix}@example.com`;
  const promoEmail = `mvpfollowpromo${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "MVP Follow Fan");
    const fanToken = await login(fanEmail);
    const fanMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${fanToken}`);
    const fanId = fanMe.body.user.id;

    await register(promoEmail, "promoter", "MVP Follow Promo");
    const promoToken = await login(promoEmail);
    const promoProfileId = await createPromoterProfile(promoToken);

    const followRes = await request(app)
      .post(`/api/promoters/${promoProfileId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(followRes.status, 200);
    assert.equal(followRes.body.success, true);

    const count1 = await pool.query(
      `SELECT COUNT(*) AS c FROM echoroom.promoter_follows WHERE follower_id = $1 AND promoter_id = $2`,
      [fanId, promoProfileId]
    );
    assert.equal(Number(count1.rows[0].c), 1);

    const unfollowRes = await request(app)
      .delete(`/api/promoters/${promoProfileId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(unfollowRes.status, 200);
    assert.equal(unfollowRes.body.success, true);

    const count2 = await pool.query(
      `SELECT COUNT(*) AS c FROM echoroom.promoter_follows WHERE follower_id = $1 AND promoter_id = $2`,
      [fanId, promoProfileId]
    );
    assert.equal(Number(count2.rows[0].c), 0);
  } finally {
    await cleanup(fanEmail);
    await cleanup(promoEmail);
  }
});

test("Promoters can only edit their own events", async (t) => {
  const emailA = `mvpowneda${suffix}@example.com`;
  const emailB = `mvpownedb${suffix}@example.com`;
  try {
    await register(emailA, "promoter", "MVP Owner A");
    await register(emailB, "promoter", "MVP Owner B");
    const tokenA = await login(emailA);
    const tokenB = await login(emailB);

    const eventId = await createEvent(tokenA);

    const editRes = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ title: "Updated Title" });
    assert.equal(editRes.status, 200);
    assert.equal(editRes.body.success, true);

    const hackRes = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ title: "Hacked" });
    assert.equal(hackRes.status, 403);
    assert.equal(hackRes.body.success, false);
  } finally {
    await cleanup(emailA);
    await cleanup(emailB);
  }
});

test("Fan cannot create events", async (t) => {
  const email = `mvpnoeventfan${suffix}@example.com`;
  try {
    await register(email, "fan", "MVP No Event Fan");
    const token = await login(email);

    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Fan Event",
        artists: ["X"],
        venue: "Y",
        city: "Z",
        start_at: future(1),
        end_at: future(2),
      });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});
