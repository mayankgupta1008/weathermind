import express from "express";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";
import connectDB from "@weather-agent/shared/src/common/db.config.js";
import { auth } from "@weather-agent/shared/src/common/auth.config.js";
import weatherScheduleRouter from "./routes/weatherSchedule.route.js";
import {
  initMetrics,
  metricsEndpoint,
  contentType,
} from "@weather-agent/shared/src/monitoring/metrics.js";

dotenv.config();

const app = express();

/**
 * 2. Mount BetterAuth Handler
 * This single line handles ALL auth logic:
 * - POST /api/auth/sign-up/email
 * - POST /api/auth/sign-in/email
 * - GET  /api/auth/get-session
 * - etc.
 */

// Better-auth suggests to put this before express.json()
app.use("/api/auth", toNodeHandler(auth));

app.use(express.json());

initMetrics("backend");

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/metrics", async (req, res) => {
  res.set("Content-Type", contentType);
  res.end(await metricsEndpoint());
});

app.use("/api/schedule", weatherScheduleRouter);

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    // Used .then() and .catch() as we need to reduce the up time when a kubernetes pod starts. If we use async-await then ir will wait for the database to connect before starting the server hence increasing the up time.
    connectDB()
      .then(() => console.log("DB ready"))
      .catch((err) => console.error("DB failed"));
    app.listen(PORT, () => {
      process.env.NODE_ENV === "production"
        ? console.log(`Backend service running on ${PORT}`)
        : console.log(`Backend service running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();
