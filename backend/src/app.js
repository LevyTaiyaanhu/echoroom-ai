import express from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
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

app.use(notFound);
app.use(errorHandler);

export default app;