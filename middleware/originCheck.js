/**
 * Blocks state-changing requests (POST/PUT/PATCH/DELETE) whose
 * Origin/Referer header does not match this site's own domain.
 *
 * This is the practical, application-level defense against a
 * cloned copy of the front-end (hosted on another domain) trying to
 * submit forms against this backend using a stolen session cookie
 * or CSRF token, and against the site being framed/embedded from a
 * third-party origin. It is a mitigation, not a guarantee -- a
 * determined attacker scripting server-to-server requests can still
 * forge headers, which is why session auth + CSRF tokens + rate
 * limiting are layered on top rather than relied on alone.
 */
function originCheck(req, res, next) {
  const siteUrl = process.env.SITE_URL;

  // If SITE_URL isn't configured yet (e.g. first local run), skip
  // the check rather than locking the operator out of their own app.
  if (!siteUrl) return next();

  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!mutating) return next();

  let siteHost;
  try {
    siteHost = new URL(siteUrl).host;
  } catch (err) {
    return next();
  }

  const originHeader = req.get("origin") || req.get("referer") || "";
  if (!originHeader) {
    // Some legitimate same-site requests omit Origin/Referer
    // (older browsers, some privacy modes). Do not hard-block; rely
    // on the CSRF token check for these instead.
    return next();
  }

  let requestHost;
  try {
    requestHost = new URL(originHeader).host;
  } catch (err) {
    return res.status(403).json({ error: "Invalid request origin." });
  }

  if (requestHost !== siteHost) {
    return res.status(403).json({
      error: "Request blocked: origin does not match this site's domain.",
    });
  }

  next();
}

module.exports = originCheck;
