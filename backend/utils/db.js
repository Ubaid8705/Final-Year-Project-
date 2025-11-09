import mongoose from "mongoose";

const DEFAULT_DB_NAME = "blogshive";
const DEFAULT_URI = "mongodb://127.0.0.1:27017/blogshive";
let cachedConnection = null;
let connectionPromise = null;
let listenersInitialized = false;

const resolveDbName = () => {
  const name = process.env.MONGO_DB_NAME;
  if (name && typeof name === "string" && name.trim().length > 0) {
    return name.trim();
  }
  return DEFAULT_DB_NAME;
};

const initializeListeners = () => {
  if (listenersInitialized) {
    return;
  }

  mongoose.connection.on("connected", () => {
    const dbName = mongoose.connection.name;
    console.log(`MongoDB connected${dbName ? ` to ${dbName}` : ""}`);
  });

  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error);
  });

  mongoose.connection.on("disconnected", () => {
    cachedConnection = null;
    connectionPromise = null;
    console.warn("MongoDB connection lost");
  });

  process.once("SIGINT", async () => {
    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed due to app termination");
    } finally {
      cachedConnection = null;
      connectionPromise = null;
      process.exit(0);
    }
  });

  listenersInitialized = true;
};

const connectWithUri = async (uri) => {
  mongoose.set("strictQuery", false);

  const connection = await mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 5000,
    connectTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 15000,
    dbName: resolveDbName(),
  });

  cachedConnection = connection.connection;
  return cachedConnection;
};

export const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (!connectionPromise) {
    initializeListeners();

    const primaryUri = process.env.MONGO_URI || DEFAULT_URI;
    const fallbackUri = DEFAULT_URI;

    connectionPromise = connectWithUri(primaryUri).catch(async (primaryError) => {
      connectionPromise = null;

      if (primaryUri === fallbackUri) {
        throw primaryError;
      }

      console.warn(
        `Primary MongoDB connection failed (${primaryError.message}). Attempting fallback to ${fallbackUri}`
      );

      try {
        connectionPromise = connectWithUri(fallbackUri);
        return await connectionPromise;
      } catch (fallbackError) {
        console.error("Fallback MongoDB connection attempt failed:", fallbackError);
        throw primaryError;
      }
    });
  }

  return connectionPromise;
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    cachedConnection = null;
    connectionPromise = null;
  }
};
