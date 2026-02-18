function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  if (process.env.NODE_ENV !== "test") {
    console.error(`[ERROR] ${statusCode} - ${message}`, err.stack || "");
  }

  res.status(statusCode).json({
    error: message,
    code: statusCode,
  });
}

module.exports = errorHandler;
