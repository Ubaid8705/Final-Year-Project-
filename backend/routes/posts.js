import express from "express";
import {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  clapPost,
  listAuthorPosts,
  listDrafts,
} from "../controllers/postController.js";
import { authenticate, optionalAuthenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", optionalAuthenticate, listPosts);
router.get("/drafts", authenticate, listDrafts);
router.get("/author/:username", optionalAuthenticate, listAuthorPosts);
router.get("/:idOrSlug", optionalAuthenticate, getPost);
router.post("/", authenticate, createPost);
router.patch("/:idOrSlug", authenticate, updatePost);
router.delete("/:idOrSlug", authenticate, deletePost);
router.post("/:idOrSlug/clap", authenticate, clapPost);

export default router;
