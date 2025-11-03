import express from "express";
import {
  getCurrentSettings,
  updateSettings,
} from "../controllers/settingsController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", authenticate, getCurrentSettings);
router.put("/me", authenticate, updateSettings);

export default router;
