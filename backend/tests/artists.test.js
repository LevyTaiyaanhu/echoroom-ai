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

test("POST /api/artists/me requires authentication", async (t) => {
  const res = await request(app).post("/api/artists/me").send({ stage_name: "X" });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("POST /api/artists/me requires artist role", async (t) => {
  const email = `fanartist${suffix}@example.com`;
  try {
    await register(email, "fan", "Fan Person");
    const token = await login(email);
    const res = await request(app)
      .post("/api/artists/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ stage_name: "X" });
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/artists/me creates an artist profile", async (t) => {
  const email = `artistcreate${suffix}@example.com`;
  try {
    await register(email, "artist", "Artist Person");
    const token = await login(email);
    const res = await createArtistProfile(token);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.artist.stage_name, "Test Artist");
    assert.equal(res.body.artist.genre, "Amapiano");
    assert.equal(res.body.artist.is_private, false);
    assert.ok(res.body.artist.id);
    // Private fields should be present for owner
    assert.equal(res.body.artist.email, email);
    assert.equal(res.body.artist.full_name, "Artist Person");
  } finally {
    await cleanup(email);
  }
});

test("POST /api/artists/me rejects duplicate profile", async (t) => {
  const email = `artistdup${suffix}@example.com`;
  try {
    await register(email, "artist", "Artist Dup");
    const token = await login(email);
    await createArtistProfile(token);
    const res = await createArtistProfile(token);
    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/artists/me returns own profile with private fields", async (t) => {
  const email = `artistme${suffix}@example.com`;
  try {
    await register(email, "artist", "Artist Me");
    const token = await login(email);
    await createArtistProfile(token, { is_private: true });
    const res = await request(app)
      .get("/api/artists/me")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.artist.is_private, true);
    assert.equal(res.body.artist.email, email);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/artists/me returns 404 when no profile exists", async (t) => {
  const email = `artistnoprofile${suffix}@example.com`;
  try {
    await register(email, "artist", "Artist No Profile");
    const token = await login(email);
    const res = await request(app)
      .get("/api/artists/me")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("PUT /api/artists/me updates own profile", async (t) => {
  const email = `artistupdate${suffix}@example.com`;
  try {
    await register(email, "artist", "Artist Update");
    const token = await login(email);
    await createArtistProfile(token);
    const res = await request(app)
      .put("/api/artists/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ stage_name: "Updated Artist", city: "Bulawayo" });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.artist.stage_name, "Updated Artist");
    assert.equal(res.body.artist.city, "Bulawayo");
  } finally {
    await cleanup(email);
  }
});

test("GET /api/artists returns public list excluding private profiles", async (t) => {
  const email1 = `artistpub1${suffix}@example.com`;
  const email2 = `artistpub2${suffix}@example.com`;
  try {
    await register(email1, "artist", "Artist Public 1");
    const token1 = await login(email1);
    await createArtistProfile(token1, { stage_name: "Public Artist", genre: "House" });

    await register(email2, "artist", "Artist Public 2");
    const token2 = await login(email2);
    await createArtistProfile(token2, { stage_name: "Private Artist", is_private: true });

    const res = await request(app).get("/api/artists");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const names = res.body.artists.map((a) => a.stage_name);
    assert.ok(names.includes("Public Artist"));
    assert.ok(!names.includes("Private Artist"));
    // Public profiles should not have is_private or email
    for (const a of res.body.artists) {
      assert.equal(a.is_private, undefined);
      assert.equal(a.email, undefined);
    }
  } finally {
    await cleanup(email1);
    await cleanup(email2);
  }
});

test("GET /api/artists supports genre and city filters", async (t) => {
  const email = `artistfilter${suffix}@example.com`;
  try {
    await register(email, "artist", "Artist Filter");
    const token = await login(email);
    await createArtistProfile(token, { stage_name: "Filter Artist", genre: "Amapiano", city: "Harare" });

    const genreRes = await request(app).get("/api/artists?genre=Amapiano");
    assert.equal(genreRes.status, 200);
    assert.ok(genreRes.body.artists.some((a) => a.stage_name === "Filter Artist"));

    const cityRes = await request(app).get("/api/artists?city=Harare");
    assert.equal(cityRes.status, 200);
    assert.ok(cityRes.body.artists.some((a) => a.stage_name === "Filter Artist"));

    const noMatchRes = await request(app).get("/api/artists?genre=Gospel");
    assert.equal(noMatchRes.status, 200);
    assert.ok(!noMatchRes.body.artists.some((a) => a.stage_name === "Filter Artist"));
  } finally {
    await cleanup(email);
  }
});

test("GET /api/artists/:id returns public profile only", async (t) => {
  const email = `artistdetail${suffix}@example.com`;
  try {
    await register(email, "artist", "Artist Detail");
    const token = await login(email);
    await createArtistProfile(token, { stage_name: "Detail Artist", is_private: false });

    // Get the profile id from the public list
    const listRes = await request(app).get("/api/artists");
    const profile = listRes.body.artists.find((a) => a.stage_name === "Detail Artist");
    assert.ok(profile, "Profile should be in public list");

    const res = await request(app).get(`/api/artists/${profile.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.artist.stage_name, "Detail Artist");
    // Private fields should NOT be present
    assert.equal(res.body.artist.is_private, undefined);
    assert.equal(res.body.artist.email, undefined);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/artists/:id returns 404 for private profile", async (t) => {
  const email = `artistprivate${suffix}@example.com`;
  try {
    await register(email, "artist", "Artist Private");
    const token = await login(email);
    await createArtistProfile(token, { stage_name: "Hidden Artist", is_private: true });

    const listRes = await request(app).get("/api/artists");
    const profile = listRes.body.artists.find((a) => a.stage_name === "Hidden Artist");
    assert.equal(profile, undefined, "Private profile should not be in public list");

    // Try to access by id - we need to get the id from the owner's profile
    const meRes = await request(app)
      .get("/api/artists/me")
      .set("Authorization", `Bearer ${token}`);
    const privateId = meRes.body.artist.id;

    const res = await request(app).get(`/api/artists/${privateId}`);
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/artists/me/picture uploads profile picture", async (t) => {
  const email = `artistpic${suffix}@example.com`;
  try {
    await register(email, "artist", "Artist Pic");
    const token = await login(email);
    await createArtistProfile(token);

    const res = await request(app)
      .post("/api/artists/me/picture")
      .set("Authorization", `Bearer ${token}`)
      .attach("profile_picture", Buffer.from("fake-image-data"), "test.png");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.profile_picture_url);
  } finally {
    await cleanup(email);
  }
});

test("DELETE /api/artists/me/picture removes profile picture", async (t) => {
  const email = `artistdelpic${suffix}@example.com`;
  try {
    await register(email, "artist", "Artist Del Pic");
    const token = await login(email);
    await createArtistProfile(token);
    await request(app)
      .post("/api/artists/me/picture")
      .set("Authorization", `Bearer ${token}`)
      .attach("profile_picture", Buffer.from("fake-image-data"), "test.png");

    const res = await request(app)
      .delete("/api/artists/me/picture")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  } finally {
    await cleanup(email);
  }
});

test("Fan cannot access artist profile endpoints", async (t) => {
  const email = `fannoartist${suffix}@example.com`;
  try {
    await register(email, "fan", "Fan No Artist");
    const token = await login(email);
    const res = await request(app)
      .post("/api/artists/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ stage_name: "X" });
    assert.equal(res.status, 403);
  } finally {
    await cleanup(email);
  }
});
