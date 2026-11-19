
import "dotenv/config";

const port = Number(process.env.PORT ?? 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET must be configured with at least 32 characters",
  );
}

// Gemini models known to support image input and generateContent.
const VALID_GEMINI_MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

const geminiModel = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

if (!VALID_GEMINI_MODELS.includes(geminiModel)) {
  throw new Error(
    `GEMINI_MODEL "${geminiModel}" is not a recognized model. ` +
      `Use one of: ${VALID_GEMINI_MODELS.join(", ")}`,
  );
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port,
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel,
  maxFileSize: Number(process.env.MAX_FILE_SIZE ?? 5242880),
};
