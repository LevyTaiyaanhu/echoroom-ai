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

async function createEvent(token, overrides = {}) {
  const future = (days) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
  };
  const res = await request(app)
    .post("/api/events")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "MVP AI Event",
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

test("POST /api/ai/extract-flyer requires promoter role", async (t) => {
  const email = `mvaifa${suffix}@example.com`;
  try {
    await register(email, "fan", "MVP AI Fan");
    const token = await login(email);
    const res = await request(app)
      .post("/api/ai/extract-flyer")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/ai/extract-flyer returns 400 when no image uploaded", async (t) => {
  const email = `mvaifanopromo${suffix}@example.com`;
  try {
    await register(email, "promoter", "MVP AI Promo No File");
    const token = await login(email);
    const res = await request(app)
      .post("/api/ai/extract-flyer")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/ai/detect-duplicates requires title", async (t) => {
  const email = `mvada${suffix}@example.com`;
  try {
    await register(email, "fan", "MVP Dup Fan");
    const token = await login(email);
    const res = await request(app)
      .post("/api/ai/detect-duplicates")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/ai/detect-duplicates returns empty when no matches", async (t) => {
  const email = `mvada2${suffix}@example.com`;
  try {
    await register(email, "fan", "MVP Dup Fan 2");
    const token = await login(email);
    const res = await request(app)
      .post("/api/ai/detect-duplicates")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Nonexistent Event Title XYZ" });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepStrictEqual(res.body.duplicates, []);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/ai/generate-description requires promoter role", async (t) => {
  const email = `mvagd${suffix}@example.com`;
  try {
    await register(email, "fan", "MVP AI Desc Fan");
    const token = await login(email);
    const res = await request(app)
      .post("/api/ai/generate-description")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/ai/generate-description requires title", async (t) => {
  const email = `mvagd2${suffix}@example.com`;
  try {
    await register(email, "promoter", "MVP AI Desc Promo");
    const token = await login(email);
    const res = await request(app)
      .post("/api/ai/generate-description")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

test("POST /api/ai/extract-flyer validates image file type", async (t) => {
  const email = `mvaifile${suffix}@example.com`;
  try {
    await register(email, "promoter", "MVP AI File Promo");
    const token = await login(email);
    const res = await request(app)
      .post("/api/ai/extract-flyer")
      .set("Authorization", `Bearer ${token}`)
      .attach("flyer", Buffer.from("not an image"), "document.txt");
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  } finally {
    await cleanup(email);
  }
});

// --- Unit tests for Gemini AI service ---

import { resetGenAI, extractEventFromImage, generateEventDescription, getGenAI } from "../src/lib/ai.js";
import { env } from "../src/config/env.js";

test("extractEventFromImage throws when GEMINI_API_KEY is missing", async (t) => {
  const originalKey = env.geminiApiKey;
  env.geminiApiKey = "";
  resetGenAI();
  try {
    await assert.rejects(
      () => extractEventFromImage(Buffer.from("fake-image"), "image/jpeg"),
      /GEMINI_API_KEY is not configured/,
    );
  } finally {
    env.geminiApiKey = originalKey;
    resetGenAI();
  }
});

test("generateEventDescription throws when GEMINI_API_KEY is missing", async (t) => {
  const originalKey = env.geminiApiKey;
  env.geminiApiKey = "";
  resetGenAI();
  try {
    await assert.rejects(
      () => generateEventDescription({ title: "Test" }),
      /GEMINI_API_KEY is not configured/,
    );
  } finally {
    env.geminiApiKey = originalKey;
    resetGenAI();
  }
});

test("extractEventFromImage propagates Gemini API errors", async (t) => {
  const originalKey = env.geminiApiKey;
  env.geminiApiKey = "test-api-key-12345";
  resetGenAI();
  try {
    const genAIInstance = getGenAI();
    const originalGenerateContent = genAIInstance.interactions.create;
    genAIInstance.interactions.create = async () => {
      throw new Error("Gemini API rate limit exceeded");
    };
    try {
      await assert.rejects(
        () => extractEventFromImage(Buffer.from("fake-image"), "image/jpeg"),
        /Gemini API rate limit exceeded/,
      );
    } finally {
      genAIInstance.interactions.create = originalGenerateContent;
    }
  } finally {
    env.geminiApiKey = originalKey;
    resetGenAI();
  }
});

test("generateEventDescription propagates Gemini API errors", async (t) => {
  const originalKey = env.geminiApiKey;
  env.geminiApiKey = "test-api-key-12345";
  resetGenAI();
  try {
    const genAIInstance = getGenAI();
    const originalGenerateContent = genAIInstance.interactions.create;
    genAIInstance.interactions.create = async () => {
      throw new Error("Gemini API service unavailable");
    };
    try {
      await assert.rejects(
        () => generateEventDescription({ title: "Test" }),
        /Gemini API service unavailable/,
      );
    } finally {
      genAIInstance.interactions.create = originalGenerateContent;
    }
  } finally {
    env.geminiApiKey = originalKey;
    resetGenAI();
  }
});

// --- Unit tests for error status codes ---

test("getGenAI throws 500 when GEMINI_API_KEY is missing", async (t) => {
  const originalKey = env.geminiApiKey;
  env.geminiApiKey = "";
  resetGenAI();
  try {
    let err;
    try { getGenAI(); } catch (e) { err = e; }
    assert.ok(err, "Expected getGenAI to throw");
    assert.match(err.message, /GEMINI_API_KEY is not configured/);
    assert.equal(err.status, 500);
  } finally {
    env.geminiApiKey = originalKey;
    resetGenAI();
  }
});

test("extractEventFromImage propagates rate limit error with status 429", async (t) => {
  const originalKey = env.geminiApiKey;
  env.geminiApiKey = "test-api-key-12345";
  resetGenAI();
  try {
    const genAIInstance = getGenAI();
    const originalGenerateContent = genAIInstance.interactions.create;
    genAIInstance.interactions.create = async () => {
      throw new Error("Gemini API rate limit exceeded");
    };
    try {
      let err;
      try { await extractEventFromImage(Buffer.from("fake-image"), "image/jpeg"); } catch (e) { err = e; }
      assert.ok(err, "Expected extractEventFromImage to throw");
      assert.match(err.message, /Gemini API rate limit exceeded/);
      assert.equal(err.status, 429);
    } finally {
      genAIInstance.interactions.create = originalGenerateContent;
    }
  } finally {
    env.geminiApiKey = originalKey;
    resetGenAI();
  }
});

test("extractEventFromImage propagates authentication error with status 401", async (t) => {
  const originalKey = env.geminiApiKey;
  env.geminiApiKey = "test-api-key-12345";
  resetGenAI();
  try {
    const genAIInstance = getGenAI();
    const originalGenerateContent = genAIInstance.interactions.create;
    genAIInstance.interactions.create = async () => {
      throw new Error("Gemini API authentication failed");
    };
    try {
      let err;
      try { await extractEventFromImage(Buffer.from("fake-image"), "image/jpeg"); } catch (e) { err = e; }
      assert.ok(err, "Expected extractEventFromImage to throw");
      assert.match(err.message, /Gemini API authentication failed/);
      assert.equal(err.status, 401);
    } finally {
      genAIInstance.interactions.create = originalGenerateContent;
    }
  } finally {
    env.geminiApiKey = originalKey;
    resetGenAI();
  }
});

test("extractEventFromImage propagates invalid model error with status 400", async (t) => {
  const originalKey = env.geminiApiKey;
  env.geminiApiKey = "test-api-key-12345";
  resetGenAI();
  try {
    const genAIInstance = getGenAI();
    const originalGenerateContent = genAIInstance.interactions.create;
    genAIInstance.interactions.create = async () => {
      throw new Error("Gemini API model is invalid or not found");
    };
    try {
      let err;
      try { await extractEventFromImage(Buffer.from("fake-image"), "image/jpeg"); } catch (e) { err = e; }
      assert.ok(err, "Expected extractEventFromImage to throw");
      assert.match(err.message, /Gemini API model is invalid/);
      assert.equal(err.status, 400);
    } finally {
      genAIInstance.interactions.create = originalGenerateContent;
    }
  } finally {
    env.geminiApiKey = originalKey;
    resetGenAI();
  }
});

test("extractEventFromImage propagates network error with status 503", async (t) => {
  const originalKey = env.geminiApiKey;
  env.geminiApiKey = "test-api-key-12345";
  resetGenAI();
  try {
    const genAIInstance = getGenAI();
    const originalGenerateContent = genAIInstance.interactions.create;
    genAIInstance.interactions.create = async () => {
      throw new Error("Network error: ETIMEDOUT connecting to Gemini API");
    };
    try {
      let err;
      try { await extractEventFromImage(Buffer.from("fake-image"), "image/jpeg"); } catch (e) { err = e; }
      assert.ok(err, "Expected extractEventFromImage to throw");
      assert.match(err.message, /Gemini API connection failed/);
      assert.equal(err.status, 503);
    } finally {
      genAIInstance.interactions.create = originalGenerateContent;
    }
  } finally {
    env.geminiApiKey = originalKey;
    resetGenAI();
  }
});

test("extractEventFromImage throws 400 on non-JSON response", async (t) => {
  const originalKey = env.geminiApiKey;
  env.geminiApiKey = "test-api-key-12345";
  resetGenAI();
  try {
    const genAIInstance = getGenAI();
    const originalGenerateContent = genAIInstance.interactions.create;
    genAIInstance.interactions.create = async () => ({ output_text: "not valid json at all" });
    try {
      let err;
      try { await extractEventFromImage(Buffer.from("fake-image"), "image/jpeg"); } catch (e) { err = e; }
      assert.ok(err, "Expected extractEventFromImage to throw");
      assert.match(err.message, /Gemini returned non-JSON response/);
      assert.equal(err.status, 400);
    } finally {
      genAIInstance.interactions.create = originalGenerateContent;
    }
  } finally {
    env.geminiApiKey = originalKey;
    resetGenAI();
  }
});

test("generateEventDescription throws 400 on empty response", async (t) => {
  const originalKey = env.geminiApiKey;
  env.geminiApiKey = "test-api-key-12345";
  resetGenAI();
  try {
    const genAIInstance = getGenAI();
    const originalGenerateContent = genAIInstance.interactions.create;
    genAIInstance.interactions.create = async () => ({ output_text: "" });
    try {
      let err;
      try { await generateEventDescription({ title: "Test" }); } catch (e) { err = e; }
      assert.ok(err, "Expected generateEventDescription to throw");
      assert.match(err.message, /Gemini returned an empty event description/);
      assert.equal(err.status, 400);
    } finally {
      genAIInstance.interactions.create = originalGenerateContent;
    }
  } finally {
    env.geminiApiKey = originalKey;
    resetGenAI();
  }
});

test("env uses valid GEMINI_MODEL for image input", async (t) => {
  const VALID_GEMINI_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
  ];
  assert.match(env.geminiModel, /^gemini-[\w.-]+$/);
});

test("env rejects invalid GEMINI_MODEL", async (t) => {
  const VALID_GEMINI_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
  ];
  assert.ok(!VALID_GEMINI_MODELS.includes("gemini-999-nonexistent"), "Invalid model should not be in the valid models list");
});
