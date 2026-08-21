function originCheck(req, res, next) {
  const siteUrl = process.env.SITE_URL;

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
