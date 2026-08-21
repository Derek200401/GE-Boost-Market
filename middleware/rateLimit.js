const rateLimit = require("express-rate-limit");

/**
 * General-purpose limiter applied to every request. Blunts basic
 * flooding / application-layer DDoS attempts against the app tier.
 * For real network-layer DDoS protection this must sit behind an
 * edge proxy such as Cloudflare in front of Railway -- see README.
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again." },
});

/**
 * Strict limiter for authentication endpoints (signup/login) to
 * blunt credential stuffing and brute-force attempts.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many attempts. Please wait a few minutes before trying again.",
  },
});

/**
 * Tighter limiter specifically on order placement to prevent wallet
 * abuse via rapid-fire submissions and to reduce load spikes against
 * the upstream JTSMM API.
 */
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many order attempts. Please slow down." },
});

module.exports = { globalLimiter, authLimiter, orderLimiter };
