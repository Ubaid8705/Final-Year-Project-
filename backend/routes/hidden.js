import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { hidePost, unhidePost } from "../controllers/hiddenPostController.js";

const router = express.Router();

router.use(authenticate);
router.post("/:postId", hidePost);
router.delete("/:postId", unhidePost);

export default router;
