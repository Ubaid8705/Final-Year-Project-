import express from "express";
import multer from "multer";
import { authenticate } from "../middleware/authMiddleware.js";
import { uploadSingleImage } from "../controllers/uploadController.js";

const router = express.Router();

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
  },
  fileFilter: (req, file, callback) => {
    if (!file?.mimetype || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(new Error("Only JPEG, PNG, WebP, GIF, AVIF, or SVG images are allowed."));
    }

    return callback(null, true);
  },
});

const singleImageMiddleware = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "Image exceeds the maximum size of 10MB." });
        return;
      }

      res.status(400).json({ error: error.message });
      return;
    }

    res.status(400).json({ error: error.message || "Failed to process uploaded image." });
  });
};

router.post("/images", authenticate, singleImageMiddleware, uploadSingleImage);

export default router;
