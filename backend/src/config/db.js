import pg from "pg";
import { getDatabaseConfig } from "./database.js";

const { Pool } = pg;

export const pool = new Pool({
  ...getDatabaseConfig(),
  max: 5,
  idleTimeoutMillis: 30000,
});

pool.on("error", (error) => {
  console.error("Unexpected idle database connection error:", error.message);
});