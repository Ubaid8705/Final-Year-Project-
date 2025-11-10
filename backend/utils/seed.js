import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Post from "../models/Post.js";
import User from "../models/User.js";
import UserSettings from "../models/Settings.js";
import { buildDefaultSettingsPayload } from "./settingsUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, "../data.json");

let seedExecution = null;

const parseDate = (value) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const selectAuthorId = (users, index) => {
  if (!users.length) {
    return null;
  }

  const seed = (index + 1) * 2654435761;
  const position = Math.abs(seed) % users.length;
  return users[position]._id;
};

const transformPost = (rawPost, users, index) => {
  if (!rawPost || typeof rawPost !== "object") {
    return null;
  }

  const { id: _ignoredId, author: _ignoredAuthor, ...rest } = rawPost;
  const authorId = selectAuthorId(users, index);
  if (!authorId) {
    return null;
  }

  const doc = { ...rest, author: authorId };

  // Let Mongoose manage these timestamp fields to avoid conflicting updates.
  delete doc.updatedAt;

  ["createdAt", "updatedAt", "publishedAt"].forEach((field) => {
    if (doc[field]) {
      const parsed = parseDate(doc[field]);
      if (parsed) {
        doc[field] = parsed;
      } else {
        delete doc[field];
      }
    }
  });

  if (doc.createdAt && !doc.publishedAt && doc.isPublished) {
    doc.publishedAt = doc.createdAt;
  }

  return doc;
};

const seedPosts = async () => {
  const existingCount = await Post.estimatedDocumentCount();
  if (existingCount > 0) {
    return false;
  }

  let users = await User.find({}).select("_id");
  if (!users.length) {
    console.warn("Skipping post seed: no users available to assign as authors.");
    return false;
  }

  try {
    const fileContents = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(fileContents);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return false;
    }

    const operations = [];

    parsed.forEach((rawPost, index) => {
      const document = transformPost(rawPost, users, index);
      if (!document || !document.slug) {
        return;
      }

      operations.push({
        updateOne: {
          filter: { slug: document.slug },
          update: { $setOnInsert: document },
          upsert: true,
        },
      });
    });

    if (!operations.length) {
      return false;
    }

    await Post.bulkWrite(operations, { ordered: false });
    console.log(`Seeded ${operations.length} posts from data.json`);
    return true;
  } catch (error) {
    console.error("Failed to seed posts:", error);
    return false;
  }
};

const provisionUserSettings = async () => {
  const userCount = await User.estimatedDocumentCount();
  if (!userCount) {
    return false;
  }

  const existingSettings = await UserSettings.find({})
    .select("user")
    .lean();

  const configuredUserIds = new Set(
    existingSettings.map((doc) => doc.user?.toString()).filter(Boolean)
  );

  const missingUsers = await User.find({
    _id: { $nin: Array.from(configuredUserIds) },
  })
    .select("_id email username name membershipStatus")
    .lean();

  if (!missingUsers.length) {
    return false;
  }

  let created = 0;

  for (const user of missingUsers) {
    const payload = buildDefaultSettingsPayload(user);
    if (!payload.email || !payload.username) {
      console.warn(
        `Skipping settings provision for user ${user._id}: missing email or username`
      );
      continue;
    }

    try {
      await UserSettings.create(payload);
      created += 1;
    } catch (error) {
      console.error(
        `Failed to create settings for user ${user._id}:`,
        error.message || error
      );
    }
  }

  if (created > 0) {
    console.log(`Provisioned default settings for ${created} user${created === 1 ? "" : "s"}.`);
    return true;
  }

  return false;
};

export const initializeSeedData = async () => {
  if (!seedExecution) {
    seedExecution = (async () => {
      const settingsProvisioned = await provisionUserSettings();
      const postsSeeded = await seedPosts();
      return settingsProvisioned || postsSeeded;
    })()
      .catch((error) => {
        console.error("Seeding tasks terminated with error:", error);
        return false;
      })
      .finally(() => {
        seedExecution = null;
      });
  }

  return seedExecution;
};
