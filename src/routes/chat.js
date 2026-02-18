const crypto = require("crypto");
const router = require("express").Router();
const modelRouter = require("../services/model-router");
const contextAssembler = require("../services/context-assembler");
const metricsService = require("../services/metrics-service");
const { initSSE, sendSSE } = require("../utils/sse");

// In-memory conversation store
const conversations = new Map();
const CONVERSATION_TTL = 24 * 60 * 60 * 1000;

// Cleanup expired conversations every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, conv] of conversations) {
    if (now - conv.lastActive > CONVERSATION_TTL) {
      conversations.delete(id);
    }
  }
}, 30 * 60 * 1000);

router.post("/", async (req, res, next) => {
  try {
    const { message, conversationId, model, stream } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId || !conversations.has(convId)) {
      convId = crypto.randomUUID();
      conversations.set(convId, {
        id: convId,
        messages: [],
        createdAt: Date.now(),
        lastActive: Date.now(),
        totalTokens: 0,
        totalCost: 0,
      });
    }

    const conv = conversations.get(convId);
    conv.lastActive = Date.now();

    // Assemble system context
    const systemContext = await contextAssembler.assembleContext();

    // Build messages array
    const chatMessages = [
      { role: "system", content: systemContext },
      ...conv.messages.slice(-20), // Last 20 messages for context window
      { role: "user", content: message },
    ];

    // Store user message
    conv.messages.push({ role: "user", content: message, timestamp: Date.now() });

    const chatStart = Date.now();

    if (stream) {
      // Streaming mode
      initSSE(res);

      try {
        const { provider, stream: tokenStream } = await modelRouter.chatCompletion({
          messages: chatMessages,
          model,
          stream: true,
        });

        let fullResponse = "";
        let usage = { promptTokens: 0, completionTokens: 0 };

        for await (const chunk of tokenStream) {
          if (chunk.text) {
            fullResponse += chunk.text;
            sendSSE(res, "token", { text: chunk.text });
          }
          if (chunk.done && chunk.usage) {
            usage = chunk.usage;
          }
        }

        // Store assistant message
        conv.messages.push({
          role: "assistant",
          content: fullResponse,
          timestamp: Date.now(),
          provider,
          model,
        });

        const latencyMs = Date.now() - chatStart;
        metricsService.recordChat(latencyMs);
        metricsService.addActivity("chat", message.slice(0, 80), {
          model: model || "default",
          provider,
        });

        sendSSE(res, "done", {
          conversationId: convId,
          provider,
          model,
          usage,
          latencyMs,
        });
        res.end();
      } catch (err) {
        sendSSE(res, "error", { error: err.message });
        res.end();
      }
    } else {
      // Non-streaming mode
      const result = await modelRouter.chatCompletion({
        messages: chatMessages,
        model,
        stream: false,
      });

      // Store assistant message
      conv.messages.push({
        role: "assistant",
        content: result.content,
        timestamp: Date.now(),
        provider: result.provider,
        model: result.model,
      });

      conv.totalTokens += result.usage.totalTokens;
      conv.totalCost += result.cost;

      const latencyMs = Date.now() - chatStart;
      metricsService.recordChat(latencyMs);
      metricsService.addActivity("chat", message.slice(0, 80), {
        model: result.model,
        provider: result.provider,
      });

      res.json({
        response: result.content,
        conversationId: convId,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        cost: result.cost,
        latencyMs,
      });
    }
  } catch (err) {
    next(err);
  }
});

router.get("/history", (req, res) => {
  const { conversationId } = req.query;
  if (!conversationId || !conversations.has(conversationId)) {
    return res.json({ messages: [] });
  }
  const conv = conversations.get(conversationId);
  res.json({
    conversationId,
    messages: conv.messages,
    totalTokens: conv.totalTokens,
    totalCost: conv.totalCost,
  });
});

router.get("/conversations", (_req, res) => {
  const list = Array.from(conversations.values()).map((c) => ({
    id: c.id,
    messageCount: c.messages.length,
    lastActive: new Date(c.lastActive).toISOString(),
    preview: c.messages[c.messages.length - 1]?.content?.slice(0, 80) || "",
  }));
  res.json(list.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive)));
});

module.exports = router;
