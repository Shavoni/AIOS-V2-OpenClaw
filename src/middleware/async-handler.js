/**
 * Async route handler wrapper — eliminates try/catch boilerplate from routes.
 * Catches errors and forwards them to Express error handler.
 */

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
