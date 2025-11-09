import React, { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import { normalizeTopicSlug } from "../resources/topics";

const STORAGE_TOKEN_KEY = "authToken";
const STORAGE_USER_KEY = "authUser";

const AuthContext = createContext(null);

const AVATAR_FALLBACK_BASE = "https://api.dicebear.com/7.x/initials/svg?seed=";

const normalizeTopicsList = (topics) => {
  if (!Array.isArray(topics)) {
    return [];
  }

  const unique = [];

  topics.forEach((topic) => {
    const slug = normalizeTopicSlug(topic);
    if (!slug) {
      return;
    }
    if (!unique.includes(slug)) {
      unique.push(slug);
    }
  });

  return unique;
};

const deriveAvatar = (user = {}) => {
  const candidate = [
    user.avatar,
    user.photo,
    user.picture,
    user.image,
    user.photoURL,
  ].find((value) => typeof value === "string" && value.trim().length > 0);

  if (candidate) {
    return candidate;
  }

  const seedSource = user.name || user.username || user.email || "Reader";
  return `${AVATAR_FALLBACK_BASE}${encodeURIComponent(seedSource)}`;
};

const normalizeUser = (user) => {
  if (!user || typeof user !== "object") {
    return null;
  }

  const normalized = { ...user };
  normalized.avatar = deriveAvatar(normalized);
  normalized.topics = normalizeTopicsList(normalized.topics);

  if (!normalized.name && normalized.username) {
    normalized.name = normalized.username;
  }

  return normalized;
};

const parseStoredUser = (rawUser) => {
  try {
    return JSON.parse(rawUser);
  } catch (error) {
    console.warn("Failed to parse stored user payload", error);
    localStorage.removeItem(STORAGE_USER_KEY);
    return null;
  }
};

const readJson = async (response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn("Failed to parse JSON response", error);
    return {};
  }
};

const base64UrlDecode = (input) => {
  try {
    const padded = `${input.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (input.length % 4)) % 4)}`;
    if (typeof atob === "function") {
      return decodeURIComponent(
        Array.prototype.map
          .call(atob(padded), (c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
          .join("")
      );
    }
    if (typeof Buffer === "function") {
      return Buffer.from(padded, "base64").toString("utf-8");
    }
  } catch (error) {
    console.warn("Failed to decode base64 payload", error);
  }

  return null;
};

const extractTokenPayload = (token) => {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  const decoded = base64UrlDecode(parts[1]);
  if (!decoded) {
    return null;
  }

  try {
    return JSON.parse(decoded);
  } catch (error) {
    console.warn("Failed to parse token payload", error);
    return null;
  }
};

const isTokenExpired = (token) => {
  const payload = extractTokenPayload(token);
  if (!payload?.exp) {
    return false;
  }
  const expiresAt = payload.exp * 1000;
  return Date.now() >= expiresAt;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistAuth = (nextToken, nextUser) => {
    const normalizedUser = normalizeUser(nextUser);
    if (!normalizedUser) {
      return { error: "Unable to persist user information" };
    }

    localStorage.setItem(STORAGE_TOKEN_KEY, nextToken);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(normalizedUser));
    setToken(nextToken);
    setUser(normalizedUser);
    return { user: normalizedUser, token: nextToken };
  };

  const updateStoredUser = (patch = {}) => {
    setUser((previous) => {
      if (!previous) {
        return previous;
      }

      const nextUser = normalizeUser({ ...previous, ...patch });
      if (!nextUser) {
        return previous;
      }

      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(nextUser));
      return nextUser;
    });
  };

  const clearAuth = () => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const storedUserRaw = localStorage.getItem(STORAGE_USER_KEY);

    if (storedToken && storedUserRaw) {
      if (isTokenExpired(storedToken)) {
        clearAuth();
      } else {
        const storedUser = parseStoredUser(storedUserRaw);
        if (storedUser) {
          const normalized = normalizeUser(storedUser);
          if (normalized) {
            setUser(normalized);
          }
          setToken(storedToken);
        }
      }
    }

    setLoading(false);
  }, []);

  const login = async ({ email, password }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = await readJson(response);

      if (!response.ok) {
        return { error: payload?.error || "Unable to sign in" };
      }

      if (!payload?.token || !payload?.user) {
        return { error: "Login response is missing required fields" };
      }

      if (isTokenExpired(payload.token)) {
        return { error: "Received an expired session token" };
      }

      const result = persistAuth(payload.token, payload.user);
      if (result?.error) {
        return result;
      }
      return result;
    } catch (error) {
      return { error: error.message || "Unexpected error during login" };
    }
  };

  const signup = async ({ name, username, email, password }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, username, email, password }),
      });

      const payload = await readJson(response);

      if (!response.ok) {
        return { error: payload?.error || "Unable to create account" };
      }

      return { message: payload?.message || "Registration successful" };
    } catch (error) {
      return { error: error.message || "Unexpected error during registration" };
    }
  };

  const logout = () => {
    clearAuth();
  };

  const completeOAuthLogin = ({ token: nextToken, user: nextUser }) => {
    if (!nextToken || !nextUser) {
      return { error: "Missing token or user details from OAuth response" };
    }

    if (isTokenExpired(nextToken)) {
      return { error: "Received an expired session token" };
    }

    let resolvedUser = nextUser;

    if (typeof resolvedUser === "string") {
      try {
        resolvedUser = JSON.parse(resolvedUser);
      } catch (error) {
        console.warn("Failed to parse OAuth user payload", error);
        return { error: "Unable to process user details from OAuth response" };
      }
    }

    if (!resolvedUser) {
      return { error: "Unable to process user details from OAuth response" };
    }

    return persistAuth(nextToken, resolvedUser);
  };

  const value = {
    user,
    token,
    loading,
    isTokenExpired,
    login,
    signup,
    logout,
    completeOAuthLogin,
    updateUser: updateStoredUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);