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

test("GET /api/promoters returns an empty list initially", async (t) => {
  const res = await request(app).get("/api/promoters");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.promoters));
});

test("PUT /api/promoters/me requires authentication", async (t) => {
  const res = await request(app).put("/api/promoters/me").send({ display_name: "X" });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("PUT /api/promoters/me requires promoter role", async (t) => {
  const email = `fan${suffix}@example.com`;
  try {
    await register(email, "fan", "Fan Person");
    const token = await login(email);
    const res = await request(app)
      .put("/api/promoters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ display_name: "Fan Profile" });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("PUT /api/promoters/me creates and returns a promoter profile", async (t) => {
  const email = `promoter${suffix}@example.com`;
  try {
    await register(email, "promoter", "Promo Person");
    const token = await login(email);

    const res = await request(app)
      .put("/api/promoters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ display_name: "Harare Beats", bio: "Zimbabwe music promoter", city: "Harare" });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.promoter.display_name, "Harare Beats");
    assert.equal(res.body.promoter.bio, "Zimbabwe music promoter");
    assert.equal(res.body.promoter.city, "Harare");
    assert.equal(res.body.promoter.password_hash, undefined);
  } finally {
    await cleanup(email);
  }
});

test("PUT /api/promoters/me updates existing profile (upsert)", async (t) => {
  const email = `promoter2${suffix}@example.com`;
  try {
    await register(email, "promoter", "Promo Two");
    const token = await login(email);

    await request(app)
      .put("/api/promoters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ display_name: "Original Name" });

    const res = await request(app)
      .put("/api/promoters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ display_name: "Updated Name", city: "Bulawayo" });

    assert.equal(res.status, 200);
    assert.equal(res.body.promoter.display_name, "Updated Name");
    assert.equal(res.body.promoter.city, "Bulawayo");
  } finally {
    await cleanup(email);
  }
});

test("PUT /api/promoters/me rejects invalid display_name", async (t) => {
  const email = `promoter3${suffix}@example.com`;
  try {
    await register(email, "promoter", "Promo Three");
    const token = await login(email);

    const res = await request(app)
      .put("/api/promoters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ display_name: "X" });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/promoters/:id returns 404 for unknown promoter", async (t) => {
  const res = await request(app).get("/api/promoters/00000000-0000-0000-0000-000000000000");
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test("GET /api/promoters/:id returns public profile for existing promoter", async (t) => {
  const email = `promoter4${suffix}@example.com`;
  try {
    await register(email, "promoter", "Promo Four");
    const token = await login(email);
    const me = await request(app)
      .put("/api/promoters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ display_name: "Public Promo", city: "Harare" });
    const profileId = me.body.promoter.id;

    const res = await request(app).get(`/api/promoters/${profileId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.promoter.display_name, "Public Promo");
    assert.equal(res.body.promoter.city, "Harare");
    assert.equal(res.body.promoter.password_hash, undefined);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/promoters supports search by name and city filter", async (t) => {
  const email1 = `promoter5a${suffix}@example.com`;
  const email2 = `promoter5b${suffix}@example.com`;
  try {
    await register(email1, "promoter", "Victoria Falls Guide");
    const token1 = await login(email1);
    await request(app)
      .put("/api/promoters/me")
      .set("Authorization", `Bearer ${token1}`)
      .send({ display_name: "Victoria Falls Guide", city: "Victoria Falls" });

    await register(email2, "promoter", "Harare DJ");
    const token2 = await login(email2);
    await request(app)
      .put("/api/promoters/me")
      .set("Authorization", `Bearer ${token2}`)
      .send({ display_name: "Harare DJ", city: "Harare" });

    const searchRes = await request(app).get("/api/promoters?q=Harare");
    assert.equal(searchRes.status, 200);
    const harareCount = searchRes.body.promoters.filter((p) => p.city === "Harare").length;
    assert.ok(harareCount >= 1);

    const cityRes = await request(app).get("/api/promoters?city=Victoria Falls");
    assert.equal(cityRes.status, 200);
    assert.ok(cityRes.body.promoters.some((p) => p.city === "Victoria Falls"));
  } finally {
    await cleanup(email1);
    await cleanup(email2);
  }
});

test("POST /api/promoters/:id/follow follows a promoter", async (t) => {
  const fanEmail = `fanfollow${suffix}@example.com`;
  const promoEmail = `promofollow${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "Fan Follower");
    const fanToken = await login(fanEmail);
    const fanMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${fanToken}`);
    const fanId = fanMe.body.user.id;

    await register(promoEmail, "promoter", "Promo Followed");
    const promoToken = await login(promoEmail);
    const promoMe = await request(app)
      .put("/api/promoters/me")
      .set("Authorization", `Bearer ${promoToken}`)
      .send({ display_name: "Promo Followed" });
    const promoProfileId = promoMe.body.promoter.id;

    const res = await request(app)
      .post(`/api/promoters/${promoProfileId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const count = await pool.query(
      `SELECT COUNT(*) AS c FROM echoroom.promoter_follows WHERE follower_id = $1 AND promoter_id = $2`,
      [fanId, promoProfileId]
    );
    assert.equal(Number(count.rows[0].c), 1);
  } finally {
    await cleanup(fanEmail);
    await cleanup(promoEmail);
  }
});

test("POST /api/promoters/:id/follow prevents duplicate follows", async (t) => {
  const fanEmail = `fandup${suffix}@example.com`;
  const promoEmail = `promodup${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "Fan Dup");
    const fanToken = await login(fanEmail);
    const fanMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${fanToken}`);
    const fanId = fanMe.body.user.id;

    await register(promoEmail, "promoter", "Promo Dup");
    const promoToken = await login(promoEmail);
    const promoMe = await request(app)
      .put("/api/promoters/me")
      .set("Authorization", `Bearer ${promoToken}`)
      .send({ display_name: "Promo Dup" });
    const promoProfileId = promoMe.body.promoter.id;

    await request(app)
      .post(`/api/promoters/${promoProfileId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);

    const res = await request(app)
      .post(`/api/promoters/${promoProfileId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(res.status, 200);

    const count = await pool.query(
      `SELECT COUNT(*) AS c FROM echoroom.promoter_follows WHERE follower_id = $1 AND promoter_id = $2`,
      [fanId, promoProfileId]
    );
    assert.equal(Number(count.rows[0].c), 1);
  } finally {
    await cleanup(fanEmail);
    await cleanup(promoEmail);
  }
});

test("DELETE /api/promoters/:id/follow unfollows a promoter", async (t) => {
  const fanEmail = `fanunfollow${suffix}@example.com`;
  const promoEmail = `promounfollow${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "Fan Unfollow");
    const fanToken = await login(fanEmail);
    const fanMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${fanToken}`);
    const fanId = fanMe.body.user.id;

    await register(promoEmail, "promoter", "Promo Unfollow");
    const promoToken = await login(promoEmail);
    const promoMe = await request(app)
      .put("/api/promoters/me")
      .set("Authorization", `Bearer ${promoToken}`)
      .send({ display_name: "Promo Unfollow" });
    const promoProfileId = promoMe.body.promoter.id;

    await request(app)
      .post(`/api/promoters/${promoProfileId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);

    const res = await request(app)
      .delete(`/api/promoters/${promoProfileId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const count = await pool.query(
      `SELECT COUNT(*) AS c FROM echoroom.promoter_follows WHERE follower_id = $1 AND promoter_id = $2`,
      [fanId, promoProfileId]
    );
    assert.equal(Number(count.rows[0].c), 0);
  } finally {
    await cleanup(fanEmail);
    await cleanup(promoEmail);
  }
});

test("POST /api/promoters/:id/follow returns 404 for unknown promoter", async (t) => {
  const email = `fan404${suffix}@example.com`;
  try {
    await register(email, "fan", "Fan 404");
    const token = await login(email);
    const res = await request(app)
      .post("/api/promoters/00000000-0000-0000-0000-000000000000/follow")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});