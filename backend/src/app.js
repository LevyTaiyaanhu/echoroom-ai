import express from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import promotersRoutes from "./routes/promoters.routes.js";
import eventsRoutes from "./routes/events.routes.js";
import engagementsRoutes from "./routes/engagements.routes.js";
import moderationRoutes from "./routes/moderation.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import {
  notFound,
  errorHandler,
} from "./middleware/error.middleware.js";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: env.clientUrl,
  }),
);

app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/promoters", promotersRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api", engagementsRoutes);
app.use("/api", moderationRoutes);
app.use("/api/ai", aiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;