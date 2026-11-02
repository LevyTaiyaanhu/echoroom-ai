import { fileURLToPath } from "node:url";
import pg from "pg";
import { runner } from "node-pg-migrate";

import { getDatabaseConfig } from "../src/config/database.js";

const { Client } = pg;

const client = new Client(getDatabaseConfig());

try {
  await client.connect();

  await runner({
    dbClient: client,
    dir: fileURLToPath(new URL("../migrations/", import.meta.url)),
    direction: "up",
    migrationsTable: "pgmigrations",
    count: Infinity,
  });

  console.log("Database migrations completed");
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}