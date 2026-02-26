function streamToSSE(res, asyncIterable, metadata = {}) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  if (metadata.sessionId) {
    res.write(`event: meta\ndata: ${JSON.stringify(metadata)}\n\n`);
  }

  let aborted = false;

  // Handle client disconnect
  res.on("close", () => { aborted = true; });

  (async () => {
    try {
      for await (const chunk of asyncIterable) {
        if (aborted) break;
        if (chunk.done) {
          const { text: _t, done: _d, ...doneData } = chunk;
          res.write(`event: done\ndata: ${JSON.stringify(doneData)}\n\n`);
          break;
        }
        res.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk.text, model: chunk.model, provider: chunk.provider })}\n\n`);
      }
    } catch (err) {
      if (!aborted) {
        try {
          res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
        } catch (_) { /* client already disconnected */ }
      }
      console.error("SSE stream error:", err.message);
    } finally {
      if (!aborted) res.end();
    }
  })();
}

module.exports = { streamToSSE };