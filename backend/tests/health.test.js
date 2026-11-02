import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import app from "../src/app.js";

test("GET /api/health returns API status", async () => {
  const response = await request(app).get("/api/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(
    response.body.message,
    "EchoRoom AI API is running",
  );
});

test("unknown routes return 404", async () => {
  const response = await request(app).get("/api/missing");

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
});

test("malformed JSON returns 400", async () => {
  const response = await request(app)
    .post("/api/missing")
    .set("Content-Type", "application/json")
    .send('{"broken":');

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
});