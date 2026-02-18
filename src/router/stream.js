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

  (async () => {
    try {
      for await (const chunk of asyncIterable) {
        if (chunk.done) {
          res.write(`event: done\ndata: ${JSON.stringify({ hitlMode: chunk.hitlMode })}\n\n`);
          break;
        }
        res.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk.text, model: chunk.model, provider: chunk.provider })}\n\n`);
      }
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    } finally {
      res.end();
    }
  })();
}

module.exports = { streamToSSE };