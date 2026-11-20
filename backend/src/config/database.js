
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function getDatabaseConfig() {
  const connectionString = process.env.DATABASE_URL?.trim();

  const certificatePath = process.env.DATABASE_CA_CERT_PATH;
  const certificateContent = process.env.DATABASE_CA_CERT;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  let ca;

  if (certificateContent) {
    // Support both multiline PEM certificates and escaped \n values.
    ca = certificateContent.replace(/\\n/g, "\n").trim();
  } else if (certificatePath) {
    // Supports local development using a certificate file.
    try {
      ca = readFileSync(resolve(certificatePath), "utf8").trim();
    } catch (error) {
      throw new Error(
        `Failed to read CA certificate from path '${certificatePath}': ${error.message}`,
      );
    }
  } else {
    throw new Error(
      "DATABASE_CA_CERT or DATABASE_CA_CERT_PATH is required",
    );
  }

  if (
    !ca.includes("-----BEGIN CERTIFICATE-----") ||
    !ca.includes("-----END CERTIFICATE-----")
  ) {
    throw new Error("DATABASE_CA_CERT is not a valid PEM certificate");
  }

  const url = new URL(connectionString);

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }

  // TLS is configured separately below.
  // Remove conflicting SSL parameters from the connection URL.
  for (const parameter of [
    "sslmode",
    "sslcert",
    "sslkey",
    "sslrootcert",
  ]) {
    url.searchParams.delete(parameter);
  }

  return {
    connectionString: url.toString(),

    ssl: {
      ca,
      rejectUnauthorized: true,
    },

    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  };
}
