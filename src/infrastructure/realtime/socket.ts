import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { verifyAccessToken } from "../../shared/utils/jwt.js";
import { prisma } from "../db/prisma.js";

let io: Server | null = null;

type OnlineUser = { id: string; name: string | null; image: string | null };
// A user can have multiple open tabs/sockets; only drop them from the
// "online" list once every one of their connections has closed.
const onlineUsers = new Map<string, { user: OnlineUser; socketIds: Set<string> }>();

function getOnlineUserList(): OnlineUser[] {
  return Array.from(onlineUsers.values()).map((entry) => entry.user);
}

function broadcastPresence() {
  try {
    getIo().to("feed").emit("presence:update", { users: getOnlineUserList() });
  } catch {
    // io may not be initialized yet in some runtimes
  }
}

function extractToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.length) return authToken;
  const header = socket.handshake.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

async function isConversationMember(userId: string, conversationId: string) {
  const convo = await (prisma as any).conversation.findUnique({ where: { id: conversationId } });
  return Boolean(convo && (convo.userAId === userId || convo.userBId === userId));
}

export function initSocketIo(server: HttpServer) {
  if (io) return io;

  io = new Server(server, {
    cors: { origin: true, credentials: true }
  });

  io.use((socket, next) => {
    const token = extractToken(socket);
    if (!token) return next(new Error("Unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      (socket.data as any).userId = payload.sub;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("feed");

    void (async () => {
      const userId = (socket.data as any)?.userId as string | undefined;
      if (!userId) return;

      const existing = onlineUsers.get(userId);
      if (existing) {
        existing.socketIds.add(socket.id);
      } else {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, image: true }
        });
        if (!user) return;
        onlineUsers.set(userId, { user, socketIds: new Set([socket.id]) });
      }

      socket.emit("presence:snapshot", { users: getOnlineUserList() });
      broadcastPresence();
    })();

    socket.on("disconnect", () => {
      const userId = (socket.data as any)?.userId as string | undefined;
      if (!userId) return;
      const entry = onlineUsers.get(userId);
      if (!entry) return;
      entry.socketIds.delete(socket.id);
      if (entry.socketIds.size === 0) {
        onlineUsers.delete(userId);
        broadcastPresence();
      }
    });

    socket.on("feed:join", () => socket.join("feed"));
    socket.on("feed:leave", () => socket.leave("feed"));

    socket.on("post:join", (postId: string) => {
      if (typeof postId === "string" && postId.length) socket.join(`post:${postId}`);
    });
    socket.on("post:leave", (postId: string) => {
      if (typeof postId === "string" && postId.length) socket.leave(`post:${postId}`);
    });

    socket.on("dm:join", async (conversationId: string) => {
      if (typeof conversationId !== "string" || !conversationId.length) return;
      const userId = (socket.data as any)?.userId;
      if (!userId || !(await isConversationMember(userId, conversationId))) return;
      socket.join(`dm:${conversationId}`);
    });
    socket.on("dm:leave", (conversationId: string) => {
      if (typeof conversationId === "string" && conversationId.length) socket.leave(`dm:${conversationId}`);
    });

    socket.on("dm:typing", async (payload: { conversationId?: string; isTyping?: boolean }) => {
      const conversationId = typeof payload?.conversationId === "string" ? payload.conversationId : null;
      if (!conversationId) return;
      const userId = (socket.data as any)?.userId;
      if (!userId || !(await isConversationMember(userId, conversationId))) return;
      socket.to(`dm:${conversationId}`).emit("dm:typing", { conversationId, userId, isTyping: Boolean(payload?.isTyping) });
    });
  });

  return io;
}

export function getIo() {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}
