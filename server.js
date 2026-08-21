// Railway loads environment variables itself. dotenv remains useful locally,
// but a missing optional dotenv package must not prevent the server from
// starting when the platform has already injected the environment.
try {
  require("dotenv").config();
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND" || !String(error.message).includes("'dotenv'")) {
    throw error;
  }
}

const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");

const { globalLimiter } = require("./middleware/rateLimit");
const originCheck = require("./middleware/originCheck");
const { createSessionStore } = require("./lib/firebaseSessionStore");

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const orderRoutes = require("./routes/orders");
const statusRoutes = require("./routes/status");
const settingsRoutes = require("./routes/settings");
const adminRoutes = require("./routes/admin");
const { getSettings } = require("./lib/db");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Trust the first proxy hop (Railway sits behind a load balancer),
// required for correct client IPs in rate limiting and secure cookies.
app.set("trust proxy", 1);

// ---------------------------------------------------------------
// Security headers (anti-deface / anti-clickjacking / anti-XSS)
// ---------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Cloudflare Turnstile requires loading its script/frame.
        scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
        frameSrc: ["https://challenges.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        // Never allow this site to be embedded in a frame elsewhere,
        // which is the core anti-deface / anti-clone-via-iframe control.
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.disable("x-powered-by");

// ---------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

// ---------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------
app.use(
  session({
    name: "hydra.sid",
    secret: process.env.SESSION_SECRET || "insecure_dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    store: createSessionStore(),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 12, // 12 hours
    },
  })
);

// ---------------------------------------------------------------
// Rate limiting (anti-DDoS / anti-flood at the application layer)
// ---------------------------------------------------------------
app.use(globalLimiter);

// ---------------------------------------------------------------
// Anti-clone: reject cross-origin state-changing requests
// ---------------------------------------------------------------
app.use(originCheck);

app.use(async (req, res, next) => {
  const protectedPath = /^(\/dashboard|\/orders|\/status|\/settings|\/api\/)/.test(req.path);
  if (protectedPath && !req.session.isAdmin && (await getSettings()).maintenanceMode) {
    return res.status(503).render("maintenance", { title: "Maintenance · Hydra Boosting" });
  }
  next();
});

// ---------------------------------------------------------------
// Static assets
// ---------------------------------------------------------------
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: isProduction ? "1d" : 0,
  })
);

// ---------------------------------------------------------------
// Routes
// ---------------------------------------------------------------
app.get("/", (req, res) => {
  res.redirect(req.session && req.session.userId ? "/dashboard" : "/login");
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(orderRoutes);
app.use(statusRoutes);
app.use(settingsRoutes);
app.use(adminRoutes);

// ---------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------
app.use((req, res) => {
  res.status(404).render("404");
});

// ---------------------------------------------------------------
// Central error handler (never leak stack traces / internals)
// ---------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).render("500");
});

app.listen(PORT, () => {
  console.log(`Hydra Boosting server running on port ${PORT}`);
  if (!isProduction) {
    console.log(`Local URL: http://localhost:${PORT}`);
  }
});

module.exports = app;
