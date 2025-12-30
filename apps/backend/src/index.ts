import express from "express";

import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";
import connectDB from "@weather-agent/shared/src/common/db.config.js";
import { auth } from "@weather-agent/shared/src/common/auth.config.js";
import weatherScheduleRouter from "./routes/weatherSchedule.route.js";

dotenv.config();

const app = express();

/**
 * 2. Mount BetterAuth Handler
 * This single line handles ALL auth logic:
 * - POST /auth/sign-up/email
 * - POST /auth/sign-in/email
 * - GET  /auth/get-session
 * - etc.
 */

// Better-auth suggests to put this before express.json()
app.use("/auth", toNodeHandler(auth));

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/schedule", weatherScheduleRouter);

const BACKEND_PORT = process.env.BACKEND_PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(BACKEND_PORT, () => {
      console.log(
        `Backend service running on http://localhost:${BACKEND_PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();
