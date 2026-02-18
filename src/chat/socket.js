const { Server } = require("socket.io");
const { eventBus } = require("../services/event-bus");
const { sanitizeMessage } = require("../middleware/sanitize");
const { createSocketAuthMiddleware } = require("../middleware/socket-auth");

function setupSocket(httpServer, handler, memory, authService) {
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : ['http://127.0.0.1:3000', 'http://localhost:3000'];

  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
    pingTimeout: 60000,
  });

  // ─── Authentication middleware ─────────────────────────────
  if (authService) {
    io.use(createSocketAuthMiddleware(authService));
  }

  // ─── Client connections ──────────────────────────────────
  io.on("connection", (socket) => {
    let currentSession = null;

    socket.on("join-session", (sessionId) => {
      if (currentSession) socket.leave(currentSession);
      currentSession = sessionId;
      socket.join(sessionId);
      socket.emit("session-joined", { sessionId });
    });

    // Join rooms for real-time updates
    socket.on("join-room", (room) => {
      socket.join(room);
    });

    socket.on("leave-room", (room) => {
      socket.leave(room);
    });

    socket.on("send-message", async ({ sessionId, message, profile }) => {
      if (!sessionId || !message) {
        socket.emit("error", { message: "sessionId and message required" });
        return;
      }

      message = sanitizeMessage(message);

      socket.emit("typing", true);

      try {
        const stream = handler.handleStream(sessionId, message, { profile, stream: true });

        socket.emit("response-start", { sessionId });

        let fullText = "";
        let meta = {};

        for await (const chunk of stream) {
          if (chunk.done) {
            meta = { hitlMode: chunk.hitlMode };
            break;
          }
          fullText += chunk.text;
          socket.emit("response-chunk", { text: chunk.text });
          if (chunk.model) meta.model = chunk.model;
          if (chunk.provider) meta.provider = chunk.provider;
        }

        socket.emit("response-end", {
          sessionId,
          model: meta.model,
          provider: meta.provider,
          hitlMode: meta.hitlMode,
        });
      } catch (err) {
        socket.emit("error", { message: err.message });
      } finally {
        socket.emit("typing", false);
      }
    });

    socket.on("create-session", (data = {}) => {
      try {
        const session = memory.createSession(data.title || "New Chat", data.profile || "main");
        socket.emit("session-created", session);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("load-messages", ({ sessionId, limit }) => {
      try {
        const messages = memory.getMessages(sessionId, limit || 100);
        socket.emit("messages-loaded", { sessionId, messages });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });
  });

  // ─── Event bus → Socket.io broadcasting ──────────────────
  // Store handlers so they can be cleaned up on server shutdown

  const handlers = {
    "hitl:created": (approval) => {
      io.to("approvals").emit("hitl:created", approval);
      io.to("dashboard").emit("hitl:created", approval);
    },
    "hitl:approved": (approval) => {
      io.to("approvals").emit("hitl:approved", approval);
      io.to("dashboard").emit("hitl:approved", approval);
    },
    "hitl:rejected": (approval) => {
      io.to("approvals").emit("hitl:rejected", approval);
      io.to("dashboard").emit("hitl:rejected", approval);
    },
    "chat:query": (event) => {
      io.to("dashboard").emit("chat:query", {
        agent: event.agent_name,
        latency: event.latency_ms,
        hitlMode: event.hitl_mode,
        timestamp: new Date().toISOString(),
      });
    },
    "chat:routed": (info) => {
      io.to("dashboard").emit("chat:routed", info);
    },
    "dashboard:metrics": (metrics) => {
      io.to("dashboard").emit("dashboard:metrics", metrics);
    },
    "audit:event": (event) => {
      io.to("audit").emit("audit:event", event);
    },
    // Research pipeline events
    "research:progress": (event) => {
      io.to(`research:${event.jobId}`).emit("research:progress", event);
      io.to("dashboard").emit("research:progress", event);
    },
    "research:completed": (event) => {
      io.to(`research:${event.jobId}`).emit("research:completed", event);
      io.to("dashboard").emit("research:completed", event);
    },
    "research:failed": (event) => {
      io.to(`research:${event.jobId}`).emit("research:failed", event);
      io.to("dashboard").emit("research:failed", event);
    },
    "research:queued": (event) => {
      io.to("dashboard").emit("research:queued", event);
    },
    "research:cancelled": (event) => {
      io.to(`research:${event.jobId}`).emit("research:cancelled", event);
      io.to("dashboard").emit("research:cancelled", event);
    },
  };

  for (const [event, handler] of Object.entries(handlers)) {
    eventBus.on(event, handler);
  }

  // Expose cleanup for graceful shutdown
  io._cleanupEventBus = () => {
    for (const [event, handler] of Object.entries(handlers)) {
      eventBus.off(event, handler);
    }
  };

  return io;
}

module.exports = { setupSocket };
