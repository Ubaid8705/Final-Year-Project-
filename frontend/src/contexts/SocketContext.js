import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../config";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

const DEFAULT_PAGE_SIZE = 20;

const resolveSocketUrl = () => {
  const explicit = process.env.REACT_APP_SOCKET_URL;
  if (explicit) {
    return explicit;
  }

  try {
    const parsed = new URL(API_BASE_URL);
    return parsed.origin;
  } catch (error) {
    const trimmed = API_BASE_URL.replace(/\/$/, "");
    return trimmed.replace(/\/api$/, "");
  }
};

const buildEndpoint = (path) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  try {
    return new URL(normalizedPath, API_BASE_URL).toString();
  } catch (error) {
    const trimmed = API_BASE_URL.replace(/\/$/, "");
    return `${trimmed}${normalizedPath}`;
  }
};

const SOCKET_URL = resolveSocketUrl();
const NOTIFICATIONS_ENDPOINT = buildEndpoint("/api/notifications");

const dedupeNotifications = (existing, incoming, append) => {
  const lookup = new Map();
  const seed = append ? existing : [];

  seed.forEach((item) => {
    lookup.set(item.id, item);
  });

  incoming.forEach((item) => {
    lookup.set(item.id, {
      ...(lookup.get(item.id) || {}),
      ...item,
    });
  });

  const merged = append ? [] : Array.from(lookup.values());

  if (append) {
    seed.forEach((item) => {
      merged.push(lookup.get(item.id));
    });

    incoming.forEach((item) => {
      if (!seed.find((existingItem) => existingItem.id === item.id)) {
        merged.push(item);
      }
    });
  }

  return append ? merged : Array.from(lookup.values()).sort((a, b) => {
    const left = new Date(b.createdAt).getTime();
    const right = new Date(a.createdAt).getTime();
    return left - right;
  });
};

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const userId = user?._id || user?.id || null;

  const clearState = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setNextCursor(null);
    setHasMore(false);
    setError(null);
  }, []);

  const fetchNotifications = useCallback(
    async ({ cursor, append = false } = {}) => {
      if (!token) {
        clearState();
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", DEFAULT_PAGE_SIZE);
        if (cursor) {
          params.set("cursor", cursor);
        }

        const response = await fetch(`${NOTIFICATIONS_ENDPOINT}?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to load notifications");
        }

        const payload = await response.json();
        const items = payload.items || [];

        setNotifications((current) =>
          dedupeNotifications(current, items, append).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
        setUnreadCount(payload.unreadCount ?? 0);
        setNextCursor(payload.nextCursor || null);
        setHasMore(Boolean(payload.hasMore));
      } catch (requestError) {
        console.error(requestError);
        setError(requestError.message || "Unable to load notifications");
      } finally {
        setLoading(false);
      }
    },
    [token, clearState]
  );

  useEffect(() => {
    if (!token || !userId) {
      setSocket((current) => {
        if (current) {
          current.disconnect();
        }
        return null;
      });
      clearState();
      return;
    }

    fetchNotifications();

    const client = io(SOCKET_URL, {
      autoConnect: true,
      auth: { token },
      transports: ["websocket", "polling"],
    });

    client.on("connect", () => {
      client.emit("register", String(userId));
    });

    client.on("notifications:new", (notification) => {
      if (!notification) {
        return;
      }

      setNotifications((current) => {
        const exists = current.findIndex((item) => item.id === notification.id);
        if (exists >= 0) {
          const clone = [...current];
          clone[exists] = { ...clone[exists], ...notification };
          return clone;
        }
        return [notification, ...current];
      });

      if (!notification.isRead) {
        setUnreadCount((count) => count + 1);
      }
    });

    client.on("disconnect", () => {
      setSocket(null);
    });

    setSocket(client);

    return () => {
      client.disconnect();
    };
  }, [token, userId, fetchNotifications, clearState]);

  const markAsRead = useCallback(
    async (notificationId) => {
      if (!notificationId) {
        return;
      }

      const target = notifications.find((item) => item.id === notificationId);
      if (!target || target.isRead) {
        return;
      }

      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
      );
      setUnreadCount((count) => Math.max(0, count - 1));

      if (!token) {
        return;
      }

      try {
        const response = await fetch(`${NOTIFICATIONS_ENDPOINT}/${notificationId}/read`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to update notification status");
        }

        const payload = await response.json();
        if (payload?.item) {
          setNotifications((current) =>
            current.map((item) => (item.id === notificationId ? payload.item : item))
          );
        }
      } catch (updateError) {
        console.error(updateError);
        setNotifications((current) =>
          current.map((item) => (item.id === notificationId ? { ...item, isRead: false } : item))
        );
        setUnreadCount((count) => count + 1);
      }
    },
    [notifications, token]
  );

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((item) => !item.isRead);
    if (unread.length === 0) {
      return;
    }

    const snapshot = notifications.map((item) => ({ ...item }));
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${NOTIFICATIONS_ENDPOINT}/read-all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to mark notifications as read");
      }
    } catch (updateError) {
      console.error(updateError);
      setNotifications(snapshot);
      setUnreadCount(snapshot.filter((item) => !item.isRead).length);
    }
  }, [notifications, token]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor) {
      return;
    }

    await fetchNotifications({ cursor: nextCursor, append: true });
  }, [hasMore, nextCursor, fetchNotifications]);

  const value = useMemo(
    () => ({
      socket,
      notifications,
      unreadCount,
      loading,
      error,
      hasMore,
      markAsRead,
      markAllAsRead,
      loadMore,
      refreshNotifications: fetchNotifications,
    }),
    [
      socket,
      notifications,
      unreadCount,
      loading,
      error,
      hasMore,
      markAsRead,
      markAllAsRead,
      loadMore,
      fetchNotifications,
    ]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocketContext = () => useContext(SocketContext);
