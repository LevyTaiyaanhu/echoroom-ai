import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function getDatabaseConfig() {
  const connectionString = process.env.DATABASE_URL;
  const certificatePath = process.env.DATABASE_CA_CERT_PATH;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  if (!certificatePath) {
    throw new Error("DATABASE_CA_CERT_PATH is required");
  }

  const url = new URL(connectionString);

  for (const parameter of [
    "sslmode",
    "sslcert",
    "sslkey",
    "sslrootcert",
  ]) {
    if (url.searchParams.has(parameter)) {
      throw new Error(
        `Remove ${parameter} from DATABASE_URL; TLS is configured in code`,
      );
    }
  }

  return {
    connectionString,
    ssl: {
      ca: readFileSync(resolve(certificatePath), "utf8"),
      rejectUnauthorized: true,
    },
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  };
}