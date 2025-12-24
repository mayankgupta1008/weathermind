import express from "express";

import {
  createWeatherSchedule,
  deleteWeatherSchedule,
} from "../controllers/weatherSchedule.controller.js";

import { requireAuth } from "@weather-agent/shared/src/common/auth.middleware.js";

const router = express.Router();

router.post("/create", requireAuth, createWeatherSchedule);
router.delete("/delete/:scheduleId", requireAuth, deleteWeatherSchedule);

export default router;
