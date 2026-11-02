import app from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`EchoRoom AI API listening on port ${env.port}`);
});

server.on("error", (error) => {
  console.error("Server failed to start:", error.message);
  process.exit(1);
});