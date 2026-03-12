// Load env FIRST — before any module-level code uses process.env
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

// Fix #13: Validate required environment variables at bootstrap so the server
// fails loudly with a clear message rather than crashing deep in DB/JWT code.
const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[TransLive] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

// Fix #12: Restrict CORS origin to the configured app URL instead of "*".
// In development this falls back to localhost:3000.
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Prisma client — DATABASE_URL is now available from dotenv above
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Track online users: userId → Set<socketId>
const onlineUsers = new Map<string, Set<string>>();

// Fix #30: Simple in-process rate limiter for send_message.
// Tracks the timestamp of the last N messages per user using a sliding window.
const MESSAGE_RATE_LIMIT = 10;   // max messages
const MESSAGE_RATE_WINDOW = 5000; // per 5 seconds

/** Returns true if the user has exceeded the rate limit. */
function isRateLimited(userId: string, rateLimitMap: Map<string, number[]>): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) ?? [];
  // Drop timestamps outside the window
  const recent = timestamps.filter((t) => now - t < MESSAGE_RATE_WINDOW);
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return recent.length > MESSAGE_RATE_LIMIT;
}

interface AuthSocket extends Socket {
  userId?: string;
  userName?: string;
}

async function bootstrap() {
  await app.prepare();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Fix #12: Explicit allowed origin instead of wildcard
  const io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
  });

  // Per-user rate limit state (lives as long as the server process)
  const sendRateLimitMap = new Map<string, number[]>();

  // ─── Socket.io auth middleware ────────────────────────────────
  io.use((socket: AuthSocket, next) => {
    // auth_token is HttpOnly — JS can't read it, but polling transport
    // sends it automatically in HTTP Cookie headers on the server side.
    const cookieHeader = socket.handshake.headers?.cookie ?? "";
    const cookieToken = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("auth_token="))
      ?.slice("auth_token=".length);

    const token = cookieToken ? decodeURIComponent(cookieToken) : null;

    if (!token) return next(new Error("Unauthorized"));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string };
      (socket as AuthSocket).userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  // ─── Socket.io event handlers ─────────────────────────────────
  io.on("connection", async (socket: AuthSocket) => {
    const userId = socket.userId!;

    // Track online
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId)!.add(socket.id);

    // Join all conversation rooms this user participates in
    const participations = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    for (const p of participations) {
      socket.join(`conv:${p.conversationId}`);
    }

    // Fetch user name
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    (socket as AuthSocket).userName = user?.name;

    // Notify others this user is online
    socket.broadcast.emit("user_online", { userId });

    // Send current online list to this client
    socket.emit("online_users", Array.from(onlineUsers.keys()));

    // ── join_conversation ────────────────────────────────────────
    socket.on("join_conversation", (conversationId: string) => {
      socket.join(`conv:${conversationId}`);
    });

    // ── send_message ─────────────────────────────────────────────
    socket.on("send_message", async (data: { conversationId: string; content: string; tempId: string }) => {
      // Fix #30: Reject messages that exceed the per-user rate limit
      if (isRateLimited(userId, sendRateLimitMap)) {
        socket.emit("message_error", {
          tempId: data.tempId,
          error: "You are sending messages too fast. Please slow down.",
        });
        return;
      }

      try {
        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: { language: true },
        });

        const message = await prisma.message.create({
          data: {
            content: data.content,
            messageType: "TEXT",
            originalLanguage: sender?.language ?? "bn",
            senderId: userId,
            conversationId: data.conversationId,
          },
          include: {
            sender: { select: { id: true, name: true, language: true } },
          },
        });

        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: { updatedAt: new Date() },
        });

        // Confirm to sender (replaces optimistic bubble)
        socket.emit("message_saved", { tempId: data.tempId, message });

        // Push to the other participant(s)
        socket.to(`conv:${data.conversationId}`).emit("receive_message", { message });
      } catch (err) {
        console.error("send_message error:", err);
        socket.emit("message_error", { tempId: data.tempId, error: "Failed to send" });
      }
    });

    // ── typing ────────────────────────────────────────────────────
    socket.on("typing_start", (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit("user_typing", {
        userId,
        name: socket.userName,
        conversationId,
      });
    });

    socket.on("typing_stop", (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit("user_stop_typing", { userId, conversationId });
    });

    // ── disconnect ────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit("user_offline", { userId });
        }
      }
    });
  });

  const PORT = parseInt(process.env.PORT ?? "3000", 10);
  httpServer.listen(PORT, () => {
    console.log(`> TransLive ready on http://localhost:${PORT}`);
    console.log(`> CORS allowed origin: ${ALLOWED_ORIGIN}`);
  });
}

bootstrap().catch(console.error);
