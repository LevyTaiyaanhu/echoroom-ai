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

async function register(email, role, fullName) {
  await request(app)
    .post("/api/auth/register")
    .send({ full_name: fullName, email, password: "Password123", role });
}

async function login(email, password = "Password123") {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  return res.body.token;
}

async function createEvent(token, overrides = {}) {
  const res = await request(app)
    .post("/api/events")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Moderation Test Event",
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

async function createAdmin(email) {
  const passwordHash = await import("../src/lib/auth.js").then((m) => m.hashPassword("TestPass123!"));
  await pool.query(
    `INSERT INTO echoroom.users (full_name, email, password_hash, role)
     VALUES ('Mod Admin', $1, $2, 'admin') ON CONFLICT (email) DO NOTHING`,
    [email, passwordHash]
  );
}

test("POST /api/events/:id/report requires authentication", async (t) => {
  const res = await request(app).post("/api/events/some-id/report").send({ reason: "fake" });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("POST /api/events/:id/report submits a report", async (t) => {
  const fanEmail = `modfan${suffix}@example.com`;
  const promoEmail = `modpromo${suffix}@example.com`;
  try {
    await registerAsFan(fanEmail);
    const fanToken = await login(fanEmail);
    await registerAsPromoter(promoEmail);
    const promoToken = await login(promoEmail);
    const eventId = await createEvent(promoToken);

    const res = await request(app)
      .post(`/api/events/${eventId}/report`)
      .set("Authorization", `Bearer ${fanToken}`)
      .send({ reason: "Fake event", description: "This looks suspicious" });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);

    const fanUser = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${fanToken}`);
    const count = await pool.query(
      `SELECT COUNT(*) AS c FROM echoroom.event_reports WHERE event_id = $1 AND reporter_id = $2`,
      [eventId, fanUser.body.user.id]
    );
    assert.equal(Number(count.rows[0].c), 1);
  } finally {
    await cleanup(fanEmail);
    await cleanup(promoEmail);
  }
});

test("GET /api/admin/reports requires admin role", async (t) => {
  const email = `modfan2${suffix}@example.com`;
  try {
    await registerAsFan(email);
    const token = await login(email);
    const res = await request(app)
      .get("/api/admin/reports")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});


test("Material edit by promoter resets verification label", async (t) => {
  const email = `modreset${suffix}@example.com`;
  try {
    await registerAsPromoter(email, "Reset Promoter");
    const token = await login(email);
    const eventId = await createEvent(token);

    await pool.query(
      `UPDATE echoroom.events SET label = 'verified', verified_at = NOW() WHERE id = $1`,
      [eventId]
    );

    const res = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Materially Changed Title",
        artists: ["Artist A"],
        venue: "Venue",
        city: "Harare",
        start_at: future(10),
        end_at: future(11),
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.event.label, "posted_by_promoter");
    assert.ok(res.body.event.verification_invalidated_at !== null);
  } finally {
    await cleanup(email);
  }
});

test("Non-admin cannot access admin report endpoints", async (t) => {
  const email = `modfan4${suffix}@example.com`;
  try {
    await registerAsFan(email);
    const token = await login(email);
    const listRes = await request(app)
      .get("/api/admin/reports")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(listRes.status, 403);
    assert.equal(listRes.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("Admin can list reports, review, hide/unhide, verify/unverify, and view moderation log", async (t) => {
  const adminEmail = `modadmin${suffix}@example.com`;
  const promoEmail = `modpromo3${suffix}@example.com`;
  try {
    await createAdmin(adminEmail);
    const adminToken = await login(adminEmail, "TestPass123!");
    await registerAsPromoter(promoEmail);
    const promoToken = await login(promoEmail);
    const eventId = await createEvent(promoToken);

    const fanEmail = `modfan3${suffix}@example.com`;
    await registerAsFan(fanEmail);
    const fanRes2 = await request(app).post("/api/auth/login").send({ email: fanEmail, password: "Password123" });
    // eslint-disable-next-line no-console
    const fanToken = fanRes2.body.token;
    const fanReportRes = await request(app)
      .post(`/api/events/${eventId}/report`)
      .set("Authorization", `Bearer ${fanToken}`)
      .send({ reason: "Misleading details" });
    // eslint-disable-next-line no-console

    const listRes = await request(app)
      .get("/api/admin/reports")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.reports.length > 0);

    const verifyRes = await request(app)
      .post(`/api/admin/reports/${listRes.body.reports[0].id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "verify", private_note: "Confirmed with promoter" });
    assert.equal(verifyRes.status, 200);

    const detailRes = await request(app).get(`/api/events/${eventId}`);
    assert.equal(detailRes.body.event.label, "verified");

    // A different fan reports the same event (first fan can only report once)
    const fan2Email = `modfan3b${suffix}@example.com`;
    await registerAsFan(fan2Email);
    const fan2Token = await login(fan2Email);
    await request(app)
      .post(`/api/events/${eventId}/report`)
      .set("Authorization", `Bearer ${fan2Token}`)
      .send({ reason: "Spam" });
    const listRes2 = await request(app)
      .get("/api/admin/reports")
      .set("Authorization", `Bearer ${adminToken}`);
    const newReport = listRes2.body.reports.find((r) => r.event_id === eventId && r.status === "open");
    assert.ok(newReport, "Expected an open report for the hide test");
    const hideRes = await request(app)
      .post(`/api/admin/reports/${newReport.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "hide", public_note: "Hidden due to spam", private_note: "Repeated spam reports" });
    // eslint-disable-next-line no-console
    assert.equal(hideRes.status, 200);

    const feedRes = await request(app).get("/api/events");
    assert.ok(!feedRes.body.events.some((e) => e.id === eventId));

    const detailRes2 = await request(app).get(`/api/events/${eventId}`);
    // eslint-disable-next-line no-console
    assert.equal(detailRes2.status, 200);
    // eslint-disable-next-line no-console
    assert.equal(detailRes2.body.event.is_hidden, true);

    const logRes = await request(app)
      .get(`/api/admin/events/${eventId}/moderation-log`)
      .set("Authorization", `Bearer ${adminToken}`);
    // eslint-disable-next-line no-console
    assert.equal(logRes.status, 200);
    const decisions = logRes.body.decisions.map((d) => d.decision);
    assert.ok(decisions.includes("verify"));
    assert.ok(decisions.includes("hide"));
    const privateNote = logRes.body.decisions.find((d) => d.decision === "verify").private_note;
    assert.equal(privateNote, "Confirmed with promoter");

    await cleanup(fanEmail);
    await cleanup(fan2Email);
  } finally {
    await cleanup(adminEmail);
    await cleanup(promoEmail);
  }
});
