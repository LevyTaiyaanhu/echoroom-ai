import "dotenv/config";

const port = Number(process.env.PORT ?? 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port,
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET ?? "qwertyuiop",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "Ab8RN6KuDhFXMj2IOm9OYkj7oLSia4M7Gzb41u0-Q1QDDFovQQ",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
  maxFileSize: Number(process.env.MAX_FILE_SIZE ?? 5242880),
};