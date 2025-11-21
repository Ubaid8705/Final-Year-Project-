import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const token = bearerToken || req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId)
      .select(
        "_id email username name avatar bio pronouns membershipStatus topics stripeCustomerId stripeSubscriptionId"
      );

    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = user;
    req.authToken = token;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Authentication failed" });
  }
};

export const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const token = bearerToken || req.cookies?.token;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select(
      "_id email username name avatar topics membershipStatus stripeCustomerId stripeSubscriptionId"
    );

    if (user) {
      req.user = user;
      req.authToken = token;
    }
  } catch (error) {
    // ignore token errors in optional flow
  }

  next();
};
