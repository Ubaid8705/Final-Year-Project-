import mongoose from "mongoose";

const DEFAULT_URI = "mongodb://127.0.0.1:27017/final-year-project";
let cachedConnection = null;
let connectionPromise = null;
let listenersInitialized = false;

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

export const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (!connectionPromise) {
    initializeListeners();

    const uri = process.env.MONGO_URI || DEFAULT_URI;
    mongoose.set("strictQuery", false);

    connectionPromise = mongoose
      .connect(uri, {
        autoIndex: process.env.NODE_ENV !== "production",
        serverSelectionTimeoutMS: 5000,
      })
      .then((mongooseInstance) => {
        cachedConnection = mongooseInstance.connection;
        return cachedConnection;
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
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
