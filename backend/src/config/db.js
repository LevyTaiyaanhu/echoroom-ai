
import pg from "pg";
import { getDatabaseConfig } from "./database.js";

const { Pool } = pg;

export const pool = new Pool({
  ...getDatabaseConfig(),

  // Keep connections low for Vercel serverless functions.
  max: 1,

  // Release idle connections sooner.
  idleTimeoutMillis: 10000,

  // Allow the process to exit when the pool is idle.
  allowExitOnIdle: true,
});

pool.on("error", (error) => {
  console.error(
    "Unexpected idle database connection error:",
    error.message,
  );
});
