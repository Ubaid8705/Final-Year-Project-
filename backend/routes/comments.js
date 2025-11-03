import express from "express";
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from "../controllers/commentController.js";
import { authenticate, optionalAuthenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", optionalAuthenticate, getComments);
router.post("/", authenticate, createComment);
router.patch("/:id", authenticate, updateComment);
router.delete("/:id", authenticate, deleteComment);

export default router;
