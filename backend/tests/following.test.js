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

async function createArtistProfile(token, overrides = {}) {
  const res = await request(app)
    .post("/api/artists/me")
    .set("Authorization", `Bearer ${token}`)
    .send({
      stage_name: "Test Artist",
      genre: "Amapiano",
      bio: "A test artist",
      city: "Harare",
      ...overrides,
    });
  return res;
}

async function createPromoterProfile(token, overrides = {}) {
  const res = await request(app)
    .put("/api/promoters/me")
    .set("Authorization", `Bearer ${token}`)
    .send({
      display_name: "Test Promoter",
      bio: "A test promoter",
      city: "Harare",
      ...overrides,
    });
  return res;
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
      title: "Test Event",
      description: "Test",
      artists: ["Test Artist"],
      venue: "Test Venue",
      city: "Harare",
      start_at: start,
      end_at: end,
      ...overrides,
    });
  return res.body.event.id;
}

test("Fan can follow and unfollow an artist", async (t) => {
  const fanEmail = `fanfollowartist${suffix}@example.com`;
  const artistEmail = `artistfollowed${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "Fan Follower");
    const fanToken = await login(fanEmail);
    const fanMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${fanToken}`);
    const fanId = fanMe.body.user.id;

    await register(artistEmail, "artist", "Artist Followed");
    const artistToken = await login(artistEmail);
    const artistRes = await createArtistProfile(artistToken);
    const artistId = artistRes.body.artist.id;

    const followRes = await request(app)
      .post(`/api/artists/${artistId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(followRes.status, 200);
    assert.equal(followRes.body.success, true);

    const countRes = await pool.query(
      `SELECT COUNT(*) AS c FROM echoroom.artist_follows WHERE follower_id = $1 AND artist_id = $2`,
      [fanId, artistId]
    );
    assert.equal(Number(countRes.rows[0].c), 1);

    const unfollowRes = await request(app)
      .delete(`/api/artists/${artistId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(unfollowRes.status, 200);
    assert.equal(unfollowRes.body.success, true);

    const countRes2 = await pool.query(
      `SELECT COUNT(*) AS c FROM echoroom.artist_follows WHERE follower_id = $1 AND artist_id = $2`,
      [fanId, artistId]
    );
    assert.equal(Number(countRes2.rows[0].c), 0);
  } finally {
    await cleanup(fanEmail);
    await cleanup(artistEmail);
  }
});

test("Prevent duplicate artist follows", async (t) => {
  const fanEmail = `fanartisdupfollow${suffix}@example.com`;
  const artistEmail = `artistdupfollow${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "Fan Dup Follow");
    const fanToken = await login(fanEmail);
    const fanMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${fanToken}`);
    const fanId = fanMe.body.user.id;

    await register(artistEmail, "artist", "Artist Dup Follow");
    const artistToken = await login(artistEmail);
    const artistRes = await createArtistProfile(artistToken);
    const artistId = artistRes.body.artist.id;

    await request(app)
      .post(`/api/artists/${artistId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);

    const res = await request(app)
      .post(`/api/artists/${artistId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(res.status, 200);

    const count = await pool.query(
      `SELECT COUNT(*) AS c FROM echoroom.artist_follows WHERE follower_id = $1 AND artist_id = $2`,
      [fanId, artistId]
    );
    assert.equal(Number(count.rows[0].c), 1);
  } finally {
    await cleanup(fanEmail);
    await cleanup(artistEmail);
  }
});

test("Cannot follow yourself as an artist", async (t) => {
  const email = `selfartistfollow${suffix}@example.com`;
  try {
    await register(email, "artist", "Self Artist");
    const token = await login(email);
    const artistRes = await createArtistProfile(token);
    const artistId = artistRes.body.artist.id;

    const res = await request(app)
      .post(`/api/artists/${artistId}/follow`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /yourself/i);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/following returns followed artists and promoters with counts", async (t) => {
  const fanEmail = `fanlistfollow${suffix}@example.com`;
  const artistEmail = `artistlistfollow${suffix}@example.com`;
  const promoEmail = `promolistfollow${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "Fan List Follow");
    const fanToken = await login(fanEmail);

    await register(artistEmail, "artist", "Artist List Follow");
    const artistToken = await login(artistEmail);
    const artistRes = await createArtistProfile(artistToken);
    const artistId = artistRes.body.artist.id;

    await register(promoEmail, "promoter", "Promoter List Follow");
    const promoToken = await login(promoEmail);
    const promoRes = await createPromoterProfile(promoToken);
    const promoId = promoRes.body.promoter.id;

    await request(app)
      .post(`/api/artists/${artistId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);
    await request(app)
      .post(`/api/promoters/${promoId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);

    const res = await request(app)
      .get("/api/following")
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.following.counts.artists, 1);
    assert.equal(res.body.following.counts.promoters, 1);
    assert.equal(res.body.following.artists.length, 1);
    assert.equal(res.body.following.promoters.length, 1);
    assert.equal(res.body.following.artists[0].stage_name, "Test Artist");
    assert.equal(res.body.following.promoters[0].display_name, "Test Promoter");
  } finally {
    await cleanup(fanEmail);
    await cleanup(artistEmail);
    await cleanup(promoEmail);
  }
});

test("GET /api/artists/:id/followers returns artist follower count", async (t) => {
  const fanEmail = `fancountfollow${suffix}@example.com`;
  const artistEmail = `artistcountfollow${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "Fan Count Follow");
    const fanToken = await login(fanEmail);

    await register(artistEmail, "artist", "Artist Count Follow");
    const artistToken = await login(artistEmail);
    const artistRes = await createArtistProfile(artistToken);
    const artistId = artistRes.body.artist.id;

    await request(app)
      .post(`/api/artists/${artistId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);

    const res = await request(app).get(`/api/artists/${artistId}/followers`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.followers.count, 1);
  } finally {
    await cleanup(fanEmail);
    await cleanup(artistEmail);
  }
});

test("GET /api/following/events returns upcoming events from followed accounts", async (t) => {
  const fanEmail = `faneventsfollow${suffix}@example.com`;
  const artistEmail = `artisteventsfollow${suffix}@example.com`;
  const promoEmail = `promoeventsfollow${suffix}@example.com`;
  try {
    await register(fanEmail, "fan", "Fan Events Follow");
    const fanToken = await login(fanEmail);

    await register(artistEmail, "artist", "Artist Events Follow");
    const artistToken = await login(artistEmail);
    const artistRes = await createArtistProfile(artistToken, { stage_name: "Followed Artist" });
    const artistId = artistRes.body.artist.id;

    await register(promoEmail, "promoter", "Promoter Events Follow");
    const promoToken = await login(promoEmail);
    const promoRes = await createPromoterProfile(promoToken, { display_name: "Followed Promoter" });
    const promoId = promoRes.body.promoter.id;

    await request(app)
      .post(`/api/artists/${artistId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);
    await request(app)
      .post(`/api/promoters/${promoId}/follow`)
      .set("Authorization", `Bearer ${fanToken}`);

    // Create event by followed promoter
    await createEvent(promoToken, { artists: ["Followed Artist"] });

    // Create event by non-followed promoter (should not appear)
    const otherEmail = `otherpromo${suffix}@example.com`;
    await register(otherEmail, "promoter", "Other Promoter");
    const otherToken = await login(otherEmail);
    await createEvent(otherToken);

    const res = await request(app)
      .get("/api/following/events")
      .set("Authorization", `Bearer ${fanToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.events.length >= 1);
    assert.ok(res.body.events.some((e) => e.title === "Test Event"));
  } finally {
    await cleanup(fanEmail);
    await cleanup(artistEmail);
    await cleanup(promoEmail);
  }
});
