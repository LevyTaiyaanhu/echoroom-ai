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
      title: "MVP Admin Event",
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

async function makeAdmin(email) {
  await pool.query(
    `UPDATE echoroom.users SET role = 'admin' WHERE email = $1`,
    [email]
  );
}

test("GET /api/admin/users lists users (admin only)", async (t) => {
  const adminEmail = `mvadmusers${suffix}@example.com`;
  const fanEmail = `mvadmusfan${suffix}@example.com`;
  try {
    await register(adminEmail, "fan", "MVP Admin");
    await makeAdmin(adminEmail);
    await register(fanEmail, "fan", "MVP Admin Fan");

    const adminToken = await login(adminEmail);
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.users));
    assert.ok(res.body.users.some((u) => u.email === fanEmail));
  } finally {
    await cleanup(adminEmail);
    await cleanup(fanEmail);
  }
});

test("GET /api/admin/users requires admin role", async (t) => {
  const email = `mvadmusfan2${suffix}@example.com`;
  try {
    await register(email, "fan", "MVP Fan 2");
    const token = await login(email);

    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("GET /api/admin/events lists all events (admin only)", async (t) => {
  const adminEmail = `mvadmevents${suffix}@example.com`;
  const promoEmail = `mvadmeventspromo${suffix}@example.com`;
  try {
    await register(adminEmail, "fan", "MVP Admin Events");
    await makeAdmin(adminEmail);
    await register(promoEmail, "promoter", "MVP Admin Event Promo");
    const promoToken = await login(promoEmail);

    await createEvent(promoToken);
    await createEvent(promoToken, { title: "Second Admin Event" });

    const adminToken = await login(adminEmail);
    const res = await request(app)
      .get("/api/admin/events")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.events.length >= 2);
  } finally {
    await cleanup(adminEmail);
    await cleanup(promoEmail);
  }
});

test("POST /api/admin/events/:id/verify verifies an event", async (t) => {
  const adminEmail = `mvadverify${suffix}@example.com`;
  const promoEmail = `mvadverifypromo${suffix}@example.com`;
  try {
    await register(adminEmail, "fan", "MVP Verify Admin");
    await makeAdmin(adminEmail);
    await register(promoEmail, "promoter", "MVP Verify Promo");
    const promoToken = await login(promoEmail);
    const eventId = await createEvent(promoToken);

    const adminToken = await login(adminEmail);
    const res = await request(app)
      .post(`/api/admin/events/${eventId}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const detailRes = await request(app).get(`/api/events/${eventId}`);
    assert.equal(detailRes.body.event.label, "verified");
  } finally {
    await cleanup(adminEmail);
    await cleanup(promoEmail);
  }
});

test("POST /api/admin/events/:id/unverify removes verification", async (t) => {
  const adminEmail = `mvadunverify${suffix}@example.com`;
  const promoEmail = `mvadunverifypromo${suffix}@example.com`;
  try {
    await register(adminEmail, "fan", "MVP Unverify Admin");
    await makeAdmin(adminEmail);
    await register(promoEmail, "promoter", "MVP Unverify Promo");
    const promoToken = await login(promoEmail);
    const eventId = await createEvent(promoToken);

    const adminToken = await login(adminEmail);

    await request(app)
      .post(`/api/admin/events/${eventId}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);

    const res = await request(app)
      .post(`/api/admin/events/${eventId}/unverify`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const detailRes = await request(app).get(`/api/events/${eventId}`);
    assert.equal(detailRes.body.event.label, "posted_by_promoter");
    assert.equal(detailRes.body.event.verified_at, null);
  } finally {
    await cleanup(adminEmail);
    await cleanup(promoEmail);
  }
});

test("POST /api/admin/reports/:id/dismiss dismisses an open report", async (t) => {
  const adminEmail = `mvaddismiss${suffix}@example.com`;
  const promoEmail = `mvdismisspromo${suffix}@example.com`;
  const fanEmail = `mvdismissfan${suffix}@example.com`;
  try {
    await register(adminEmail, "fan", "MVP Dismiss Admin");
    await makeAdmin(adminEmail);
    await register(promoEmail, "promoter", "MVP Dismiss Promo");
    const promoToken = await login(promoEmail);
    const eventId = await createEvent(promoToken);

    await register(fanEmail, "fan", "MVP Dismiss Fan");
    const fanToken = await login(fanEmail);
    await request(app)
      .post(`/api/events/${eventId}/report`)
      .set("Authorization", `Bearer ${fanToken}`)
      .send({ reason: "Test report" });

    const adminToken = await login(adminEmail);

    const listRes = await request(app)
      .get("/api/admin/reports")
      .set("Authorization", `Bearer ${adminToken}`);
    const report = listRes.body.reports.find((r) => r.event_id === eventId);
    assert.ok(report, "Expected an open report");
    assert.equal(report.status, "open");

    const dismissRes = await request(app)
      .post(`/api/admin/reports/${report.id}/dismiss`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ note: "Resolved" });
    assert.equal(dismissRes.status, 200);
    assert.equal(dismissRes.body.success, true);

    const listRes2 = await request(app)
      .get("/api/admin/reports")
      .set("Authorization", `Bearer ${adminToken}`);
    const dismissed = listRes2.body.reports.find((r) => r.id === report.id);
    assert.equal(dismissed.status, "dismissed");
  } finally {
    await cleanup(adminEmail);
    await cleanup(promoEmail);
    await cleanup(fanEmail);
  }
});

test("GET /api/admin/events supports verified filter", async (t) => {
  const adminEmail = `mvadfilter${suffix}@example.com`;
  const promoEmail = `mvadfilterpromo${suffix}@example.com`;
  try {
    await register(adminEmail, "fan", "MVP Filter Admin");
    await makeAdmin(adminEmail);
    await register(promoEmail, "promoter", "MVP Filter Promo");
    const promoToken = await login(promoEmail);
    const eventId = await createEvent(promoToken);

    const adminToken = await login(adminEmail);

    await request(app)
      .post(`/api/admin/events/${eventId}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);

    const res = await request(app)
      .get("/api/admin/events?verified=true")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.events.some((e) => e.id === eventId && e.label === "verified"));
  } finally {
    await cleanup(adminEmail);
    await cleanup(promoEmail);
  }
});
