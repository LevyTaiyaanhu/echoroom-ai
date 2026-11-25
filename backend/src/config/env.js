import "dotenv/config";

const port = Number(process.env.PORT ?? 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters");
}

const geminiModel = (process.env.GEMINI_MODEL ?? "gemini-1.5-flash").trim();

if (!/^gemini-[\w.-]+$/.test(geminiModel)) {
  throw new Error(`GEMINI_MODEL "${geminiModel}" is not a valid Gemini model name`);
}

const geminiApiKey = (process.env.GEMINI_API_KEY ?? "")
  .trim()
  .replace(/^["']|["']$/g, "");

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port,
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  geminiApiKey,
  geminiModel,
  maxFileSize: Number(process.env.MAX_FILE_SIZE ?? 5242880),
};
