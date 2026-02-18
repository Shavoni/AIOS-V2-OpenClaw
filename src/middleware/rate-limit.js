const rateLimit = require("express-rate-limit");

// General API rate limit: 100 requests per minute
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// Chat rate limit: 30 messages per minute
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages, please slow down" },
});

// Auth rate limit: 10 attempts per 15 minutes (brute force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again in 15 minutes" },
});

// Heavy endpoints (export, report): 5 per minute
const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for resource-intensive operation" },
});

module.exports = { apiLimiter, chatLimiter, authLimiter, heavyLimiter };
