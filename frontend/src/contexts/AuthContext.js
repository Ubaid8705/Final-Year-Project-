import React, { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

const STORAGE_TOKEN_KEY = "authToken";
const STORAGE_USER_KEY = "authUser";

const AuthContext = createContext(null);

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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const storedUserRaw = localStorage.getItem(STORAGE_USER_KEY);

    if (storedToken && storedUserRaw) {
      const storedUser = parseStoredUser(storedUserRaw);
      if (storedUser) {
        setUser(storedUser);
        setToken(storedToken);
      }
    }

    setLoading(false);
  }, []);

  const persistAuth = (nextToken, nextUser) => {
    localStorage.setItem(STORAGE_TOKEN_KEY, nextToken);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  };

  const clearAuth = () => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    setToken(null);
    setUser(null);
  };

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

      persistAuth(payload.token, payload.user);
      return { user: payload.user, token: payload.token };
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

  const value = {
    user,
    token,
    loading,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);