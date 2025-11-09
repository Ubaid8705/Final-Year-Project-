import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Post from "../models/Post.js";
import User from "../models/User.js";

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

export const initializeSeedData = async () => {
  if (!seedExecution) {
    seedExecution = seedPosts()
      .catch((error) => {
        console.error("Post seeding terminated with error:", error);
        return false;
      })
      .finally(() => {
        seedExecution = null;
      });
  }

  return seedExecution;
};
