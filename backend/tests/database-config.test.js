import test from "node:test";
import assert from "node:assert/strict";
import { getDatabaseConfig } from "../src/config/database.js";

const VALID_DATABASE_URL =
  "postgresql://user:password@host:5432/db?sslmode=require";

function setupEnv(overrides = {}) {
  const original = {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_CA_CERT: process.env.DATABASE_CA_CERT,
    DATABASE_CA_CERT_PATH: process.env.DATABASE_CA_CERT_PATH,
  };

  if (overrides.DATABASE_URL === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = overrides.DATABASE_URL;
  }

  if (overrides.DATABASE_CA_CERT === undefined) {
    delete process.env.DATABASE_CA_CERT;
  } else {
    process.env.DATABASE_CA_CERT = overrides.DATABASE_CA_CERT;
  }

  if (overrides.DATABASE_CA_CERT_PATH === undefined) {
    delete process.env.DATABASE_CA_CERT_PATH;
  } else {
    process.env.DATABASE_CA_CERT_PATH = overrides.DATABASE_CA_CERT_PATH;
  }

  return () => {
    process.env.DATABASE_URL = original.DATABASE_URL;
    process.env.DATABASE_CA_CERT = original.DATABASE_CA_CERT;
    process.env.DATABASE_CA_CERT_PATH = original.DATABASE_CA_CERT_PATH;
  };
}

test("getDatabaseConfig reads CA cert from DATABASE_CA_CERT env var", (t) => {
  const restore = setupEnv({
    DATABASE_URL: VALID_DATABASE_URL,
    DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nMIIFakeCert\n-----END CERTIFICATE-----",
    DATABASE_CA_CERT_PATH: undefined,
  });
  try {
    const config = getDatabaseConfig();
    assert.equal(config.ssl.ca, "-----BEGIN CERTIFICATE-----\nMIIFakeCert\n-----END CERTIFICATE-----");
    assert.equal(config.ssl.rejectUnauthorized, true);
    assert.ok(config.connectionString.includes("postgresql://"));
  } finally {
    restore();
  }
});

test("getDatabaseConfig handles escaped \\\\n in DATABASE_CA_CERT", (t) => {
  const restore = setupEnv({
    DATABASE_URL: VALID_DATABASE_URL,
    DATABASE_CA_CERT:
      "-----BEGIN CERTIFICATE-----\\nMIIFakeCert\\n-----END CERTIFICATE-----",
    DATABASE_CA_CERT_PATH: undefined,
  });
  try {
    const config = getDatabaseConfig();
    assert.ok(config.ssl.ca.includes("\n"));
    assert.ok(config.ssl.ca.includes("-----BEGIN CERTIFICATE-----"));
    assert.ok(config.ssl.ca.includes("-----END CERTIFICATE-----"));
  } finally {
    restore();
  }
});

test("getDatabaseConfig falls back to DATABASE_CA_CERT_PATH file", (t) => {
  const restore = setupEnv({
    DATABASE_URL: VALID_DATABASE_URL,
    DATABASE_CA_CERT: undefined,
    DATABASE_CA_CERT_PATH: "/home/levy/Desktop/echoroom-ai/backend/.env",
  });
  try {
    // .env is not a valid PEM cert, so this should throw
    assert.throws(() => getDatabaseConfig(), /not a valid PEM certificate/);
  } finally {
    restore();
  }
});

test("getDatabaseConfig throws when certificate file cannot be read", (t) => {
  const restore = setupEnv({
    DATABASE_URL: VALID_DATABASE_URL,
    DATABASE_CA_CERT: undefined,
    DATABASE_CA_CERT_PATH: "/nonexistent/path/to/cert.crt",
  });
  try {
    assert.throws(() => getDatabaseConfig(), /Failed to read CA certificate/);
  } finally {
    restore();
  }
});

test("getDatabaseConfig throws when neither cert source is provided", (t) => {
  const restore = setupEnv({
    DATABASE_URL: VALID_DATABASE_URL,
    DATABASE_CA_CERT: undefined,
    DATABASE_CA_CERT_PATH: undefined,
  });
  try {
    assert.throws(() => getDatabaseConfig(), /DATABASE_CA_CERT or DATABASE_CA_CERT_PATH is required/);
  } finally {
    restore();
  }
});

test("getDatabaseConfig throws when DATABASE_URL is missing", (t) => {
  const restore = setupEnv({
    DATABASE_URL: undefined,
    DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nMIIFakeCert\n-----END CERTIFICATE-----",
    DATABASE_CA_CERT_PATH: undefined,
  });
  try {
    assert.throws(() => getDatabaseConfig(), /DATABASE_URL is required/);
  } finally {
    restore();
  }
});

test("getDatabaseConfig preserves rejectUnauthorized true", (t) => {
  const restore = setupEnv({
    DATABASE_URL: VALID_DATABASE_URL,
    DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nMIIFakeCert\n-----END CERTIFICATE-----",
    DATABASE_CA_CERT_PATH: undefined,
  });
  try {
    const config = getDatabaseConfig();
    assert.equal(config.ssl.rejectUnauthorized, true);
  } finally {
    restore();
  }
});

test("getDatabaseConfig removes conflicting SSL params from URL", (t) => {
  const restore = setupEnv({
    DATABASE_URL: "postgresql://user:password@host:5432/db?sslmode=require&sslrootcert=/some/path",
    DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nMIIFakeCert\n-----END CERTIFICATE-----",
    DATABASE_CA_CERT_PATH: undefined,
  });
  try {
    const config = getDatabaseConfig();
    assert.ok(!config.connectionString.includes("sslmode"));
    assert.ok(!config.connectionString.includes("sslrootcert"));
  } finally {
    restore();
  }
});
