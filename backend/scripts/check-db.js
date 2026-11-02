import { pool } from "../src/config/db.js";

try {
  const result = await pool.query(`
    SELECT
      current_database() AS database_name,
      NOW() AS database_time
  `);

  console.log("Database connection successful");
  console.table(result.rows);
} catch (error) {
  console.error("Database check failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}