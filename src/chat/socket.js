const { Server } = require("socket.io");

function setupSocket(httpServer, handler, memory) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
    pingTimeout: 60000,
  });

  io.on("connection", (socket) => {
    let currentSession = null;

    socket.on("join-session", (sessionId) => {
      if (currentSession) socket.leave(currentSession);
      currentSession = sessionId;
      socket.join(sessionId);
      socket.emit("session-joined", { sessionId });
    });

    socket.on("send-message", async ({ sessionId, message, profile }) => {
      if (!sessionId || !message) {
        socket.emit("error", { message: "sessionId and message required" });
        return;
      }

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

  return io;
}

module.exports = { setupSocket };
