import { Server } from "socket.io";

let ioInstance = null;
const userSockets = new Map();

const registerSocketForUser = (userId, socketId) => {
  const id = userId.toString();
  const sockets = userSockets.get(id) || new Set();
  sockets.add(socketId);
  userSockets.set(id, sockets);
};

const removeSocket = (socketId) => {
  for (const [userId, sockets] of userSockets.entries()) {
    if (sockets.has(socketId)) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        userSockets.delete(userId);
      }
      break;
    }
  }
};

export const serializeNotification = (notification) => {
  if (!notification) {
    return null;
  }

  const source = notification.toObject
    ? notification.toObject({ getters: true, virtuals: false })
    : notification;

  const recipientId =
    source.recipientId ||
    source.recipient?._id?.toString() ||
    (typeof source.recipient === "string"
      ? source.recipient
      : source.recipient?.toString?.());

  return {
    id: source._id?.toString() || source.id,
    type: source.type,
    message: source.message,
    isRead: Boolean(source.isRead),
    createdAt: source.createdAt instanceof Date ? source.createdAt.toISOString() : source.createdAt,
    updatedAt: source.updatedAt instanceof Date ? source.updatedAt.toISOString() : source.updatedAt,
    metadata: source.metadata || {},
    sender: source.sender
      ? {
          id: source.sender._id?.toString() || source.sender.id,
          name: source.sender.name,
          username: source.sender.username,
          avatar: source.sender.avatar,
        }
      : null,
    post: source.post
      ? {
          id: source.post._id?.toString() || source.post.id,
          title: source.post.title,
          slug: source.post.slug,
          coverImage: source.post.coverImage,
        }
      : null,
    recipientId,
  };
};

export const configureSocketServer = (server) => {
  const allowedOrigin = process.env.CLIENT_URL || "http://localhost:3000";

  ioInstance = new Server(server, {
    cors: {
      origin: allowedOrigin.split(",").map((origin) => origin.trim()),
      credentials: true,
    },
  });

  ioInstance.on("connection", (socket) => {
    socket.on("register", (userId) => {
      if (!userId) {
        return;
      }
      registerSocketForUser(userId, socket.id);
    });

    socket.on("disconnect", () => {
      removeSocket(socket.id);
    });
  });
};

export const emitNotification = (payload) => {
  if (!payload || !ioInstance) {
    return;
  }

  const notification = serializeNotification(payload);
  if (!notification?.recipientId) {
    return;
  }

  const sockets = userSockets.get(notification.recipientId);
  if (!sockets) {
    return;
  }

  sockets.forEach((socketId) => {
    ioInstance.to(socketId).emit("notifications:new", notification);
  });
};

export const getSocketServer = () => ioInstance;
