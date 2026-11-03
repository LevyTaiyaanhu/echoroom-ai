import { pool } from "../src/config/db.js";

const EXPECTED = [
  { schema: "echoroom", table: "users" },
  { schema: "echoroom", table: "promoter_profiles" },
];

async function main() {
  let ok = true;
  for (const { schema, table } of EXPECTED) {
    const result = await pool.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2`,
      [schema, table]
    );
    const present = Number(result.rows[0].count) > 0;
    console.log(`${schema}.${table}: ${present ? "present" : "MISSING"}`);
    if (!present) ok = false;
  }
  if (!ok) {
    console.error("Schema verification failed: expected tables are missing");
    process.exitCode = 1;
  } else {
    console.log("Schema verification passed");
  }
  await pool.end();
}

main().catch((error) => {
  console.error("Schema verification error:", error.message);
  process.exitCode = 1;
});
