import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  getNewsletter,
  updateNewsletterSubscription,
} from "../controllers/newsletterController.js";

const router = express.Router();

router.use(authenticate);
router.get("/", getNewsletter);
router.put("/", updateNewsletterSubscription);

export default router;
