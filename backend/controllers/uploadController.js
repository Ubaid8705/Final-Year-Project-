import path from "path";
import {
  isCloudinaryReady,
  uploadImageBuffer,
  mapUploadResultToAsset,
} from "../services/cloudinaryService.js";

const sanitizePurpose = (value = "") => {
  const normalized = value.toString().trim().toLowerCase();
  if (["cover", "avatar", "inline", "post"].includes(normalized)) {
    return normalized;
  }
  return "post";
};

const buildUserFolder = (userId, purpose) => {
  const safeUserId = userId ? userId.toString() : "anonymous";
  const safePurpose = sanitizePurpose(purpose);
  return `users/${safeUserId}/${safePurpose === "cover" ? "covers" : safePurpose}`;
};

const normalizeFilename = (originalName = "upload") => {
  const base = path.parse(originalName).name || "upload";
  return base.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").toLowerCase();
};

export const uploadSingleImage = async (req, res) => {
  if (!isCloudinaryReady()) {
    return res.status(500).json({ error: "Image upload service is not configured." });
  }

  const file = req.file;

  if (!file || !file.buffer) {
    return res.status(400).json({ error: "Image file is required." });
  }

  try {
    const purpose = sanitizePurpose(req.body?.purpose);
    const folder = buildUserFolder(req.user?._id, purpose);
    const filename = normalizeFilename(file.originalname);

    const uploadResult = await uploadImageBuffer(file.buffer, {
      folder,
      filename,
      useFilename: Boolean(filename),
      uniqueFilename: true,
      tags: [purpose, "post-image"],
      context: {
        caption: req.body?.caption || "",
        alt: req.body?.alt || "",
      },
    });

    const asset = mapUploadResultToAsset(uploadResult, {
      purpose,
      alt: req.body?.alt?.toString().trim() || "",
      caption: req.body?.caption?.toString().trim() || "",
    });

    if (!asset) {
      throw new Error("Unable to process uploaded asset");
    }

    return res.status(201).json({ asset });
  } catch (error) {
    console.error("Failed to upload image", error);
    return res.status(500).json({ error: "Failed to upload image." });
  }
};
