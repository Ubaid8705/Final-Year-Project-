import { v2 as cloudinary } from "cloudinary";

const {
  CLOUDINARY_CLOUD_NAME: cloudName,
  CLOUDINARY_API_KEY: apiKey,
  CLOUDINARY_API_SECRET: apiSecret,
} = process.env;

let configured = false;
let configurationError = null;

const ensureConfigured = () => {
  if (configured) {
    return;
  }

  if (configurationError) {
    throw configurationError;
  }

  if (!cloudName || !apiKey || !apiSecret) {
    configurationError = new Error("Cloudinary configuration is missing required environment values.");
    throw configurationError;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  configured = true;
};

export const isCloudinaryReady = () => {
  try {
    ensureConfigured();
    return true;
  } catch (error) {
    return false;
  }
};

export const uploadImageBuffer = async (buffer, options = {}) => {
  if (!buffer || !(buffer instanceof Buffer)) {
    throw new Error("A valid image buffer is required for upload.");
  }

  ensureConfigured();

  const {
    folder,
    filename,
    publicId,
    overwrite = true,
    eager = undefined,
    resourceType = "image",
    transformations = undefined,
    useFilename = true,
    uniqueFilename = !publicId,
    tags = undefined,
    context = undefined,
  } = options;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId || filename,
        overwrite,
        resource_type: resourceType,
        eager,
        tags,
        context,
        use_filename: useFilename,
        unique_filename: uniqueFilename,
        transformation: Array.isArray(transformations)
          ? transformations
          : undefined,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};

const normalizeTransformation = (input) => {
  if (!input) {
    return undefined;
  }

  if (Array.isArray(input)) {
    return input.filter((entry) => entry && typeof entry === "object");
  }

  if (typeof input === "object") {
    return [input];
  }

  return undefined;
};

export const buildImageUrl = (publicId, options = {}) => {
  if (!publicId) {
    return null;
  }

  ensureConfigured();

  const {
    secure = true,
    transformation,
    transforms,
    format,
    sign_url,
    ...rest
  } = options;

  const normalizedTransformation =
    normalizeTransformation(transformation) || normalizeTransformation(transforms);

  return cloudinary.url(publicId, {
    secure,
    format,
    sign_url,
    transformation: normalizedTransformation,
    ...rest,
  });
};

export const mapUploadResultToAsset = (result, overrides = {}) => {
  if (!result) {
    return null;
  }

  ensureConfigured();

  const {
    public_id: publicId,
    secure_url: secureUrl,
    width,
    height,
    format,
    bytes,
    resource_type: resourceType,
    created_at: createdAt,
  } = result;

  if (!publicId || !secureUrl) {
    return null;
  }

  const aspectRatio = width && height ? Number((width / height).toFixed(4)) : null;

  const baseTransform = [
    { width: 1600, crop: "limit" },
    { quality: "auto" },
    { fetch_format: "auto" },
  ];

  const thumbnailTransform = [
    { width: 480, crop: "limit" },
    { quality: "auto" },
    { fetch_format: "auto" },
  ];

  const placeholderTransform = [
    { width: 60, height: 60, crop: "fill" },
    { effect: "blur:800" },
    { quality: "auto:low" },
    { fetch_format: "auto" },
  ];

  const displayUrl = buildImageUrl(publicId, { transformation: baseTransform });
  const thumbnailUrl = buildImageUrl(publicId, { transformation: thumbnailTransform });
  const placeholderUrl = buildImageUrl(publicId, { transformation: placeholderTransform });

  return {
    publicId,
    format,
    bytes,
    width,
    height,
    aspectRatio,
    resourceType,
    uploadedAt: createdAt ? new Date(createdAt).toISOString() : null,
    originalUrl: secureUrl,
    secureUrl,
    displayUrl,
    thumbnailUrl,
    placeholderUrl,
    url: displayUrl,
    ...overrides,
  };
};

export default cloudinary;
