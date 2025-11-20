import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  createCheckoutSession,
  confirmCheckoutSession,
  createPortalSession,
} from "../controllers/billingController.js";

const router = Router();

router.post("/checkout-session", authenticate, createCheckoutSession);
router.post("/confirm-session", authenticate, confirmCheckoutSession);
router.post("/portal-session", authenticate, createPortalSession);

export default router;
