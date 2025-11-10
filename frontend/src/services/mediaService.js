import { API_BASE_URL } from "../config";

const readJson = async (response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
};

const normalizeAsset = (rawAsset = {}, fallbackPurpose = "post") => {
  if (!rawAsset || typeof rawAsset !== "object") {
    return null;
  }

  const asset = { ...rawAsset };
  const displayUrl = [asset.displayUrl, asset.url, asset.secureUrl, asset.originalUrl].find(
    (value) => typeof value === "string" && value.trim().length > 0
  );

  if (!displayUrl) {
    return null;
  }

  const width = Number.isFinite(Number(asset.width)) ? Number(asset.width) : undefined;
  const height = Number.isFinite(Number(asset.height)) ? Number(asset.height) : undefined;
  const aspectRatio = Number.isFinite(Number(asset.aspectRatio))
    ? Number(asset.aspectRatio)
    : width && height
    ? Number((width / height).toFixed(4))
    : undefined;

  return {
    publicId: typeof asset.publicId === "string" ? asset.publicId : undefined,
    format: typeof asset.format === "string" ? asset.format : undefined,
    bytes: Number.isFinite(Number(asset.bytes)) ? Number(asset.bytes) : undefined,
    width,
    height,
    aspectRatio,
    displayUrl,
    originalUrl:
      typeof asset.originalUrl === "string" && asset.originalUrl.trim()
        ? asset.originalUrl
        : displayUrl,
    secureUrl:
      typeof asset.secureUrl === "string" && asset.secureUrl.trim() ? asset.secureUrl : displayUrl,
    thumbnailUrl:
      typeof asset.thumbnailUrl === "string" && asset.thumbnailUrl.trim() ? asset.thumbnailUrl : undefined,
    placeholderUrl:
      typeof asset.placeholderUrl === "string" && asset.placeholderUrl.trim()
        ? asset.placeholderUrl
        : undefined,
    purpose: typeof asset.purpose === "string" ? asset.purpose : fallbackPurpose,
    alt: typeof asset.alt === "string" ? asset.alt : "",
    caption: typeof asset.caption === "string" ? asset.caption : "",
    uploadedAt:
      typeof asset.uploadedAt === "string" && asset.uploadedAt
        ? new Date(asset.uploadedAt).toISOString()
        : undefined,
  };
};

export const uploadImage = async ({ file, token, purpose = "post", alt = "", caption = "", signal }) => {
  if (!file) {
    throw new Error("An image file is required.");
  }

  const formData = new FormData();
  formData.append("image", file);
  formData.append("purpose", purpose);

  if (alt) {
    formData.append("alt", alt);
  }
  if (caption) {
    formData.append("caption", caption);
  }

  const headers = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : undefined;

  const response = await fetch(`${API_BASE_URL}/api/uploads/images`, {
    method: "POST",
    headers,
    body: formData,
    signal,
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to upload image.");
  }

  const asset = normalizeAsset(payload?.asset || payload, purpose);
  if (!asset) {
    throw new Error("Upload response is missing image metadata.");
  }

  return asset;
};

const mediaService = {
  uploadImage,
};

export default mediaService;
