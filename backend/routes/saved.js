import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  listSavedPosts,
  savePost,
  removeSavedPost,
} from "../controllers/savedPostController.js";

const router = express.Router();

router.use(authenticate);
router.get("/", listSavedPosts);
router.post("/:postId", savePost);
router.delete("/:postId", removeSavedPost);

export default router;
