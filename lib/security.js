const crypto = require("crypto");

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifies a Cloudflare Turnstile token against Cloudflare's servers.
 * Used on signup and login to block scripted/automated bot traffic,
 * which is the front line of defense against credential-stuffing and
 * form-flooding style DDoS attempts on those endpoints.
 */
async function verifyTurnstile(token, remoteIp) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey || secretKey === "your_turnstile_secret_key") {
    // Turnstile not configured yet. Fail closed in production so the
    // site never silently runs without bot protection; allow through
    // in development so local testing works without Cloudflare keys.
    if (process.env.NODE_ENV === "production") {
      return { success: false, reason: "TURNSTILE_NOT_CONFIGURED" };
    }
    return { success: true, reason: "DEV_MODE_BYPASS" };
  }

  if (!token) {
    return { success: false, reason: "MISSING_TOKEN" };
  }

  try {
    const params = new URLSearchParams();
    params.append("secret", secretKey);
    params.append("response", token);
    if (remoteIp) params.append("remoteip", remoteIp);

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await response.json();
    return { success: !!data.success, reason: data["error-codes"] || null };
  } catch (err) {
    return { success: false, reason: "VERIFY_REQUEST_FAILED" };
  }
}

/**
 * Generates a per-session CSRF token and exposes a verifier. Guards
 * every state-changing form (signup, login, order placement, password
 * change) against cross-site request forgery, which is part of the
 * anti-clone / anti-abuse posture: a cloned front-end hosted on
 * another domain cannot forge valid tokens for a victim's session.
 */
function getOrCreateCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

function verifyCsrfToken(req, submittedToken) {
  const expected = req.session.csrfToken;
  if (!expected || !submittedToken) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(submittedToken));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  verifyTurnstile,
  getOrCreateCsrfToken,
  verifyCsrfToken,
};
