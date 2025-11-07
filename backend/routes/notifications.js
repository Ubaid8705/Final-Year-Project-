import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(authenticate);

router.get("/", listNotifications);
router.patch("/read-all", markAllNotificationsAsRead);
router.patch("/:id/read", markNotificationAsRead);

export default router;
