const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const db = require("../lib/db");
const { verifyTurnstile, getOrCreateCsrfToken, verifyCsrfToken } = require("../lib/security");
const { redirectIfAuthed, markActive } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_]{4,20}$/;

router.get("/signup", redirectIfAuthed, (req, res) => {
  res.render("signup", {
    error: null,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
    csrfToken: getOrCreateCsrfToken(req),
  });
});

router.post("/signup", authLimiter, redirectIfAuthed, asyncHandler(async (req, res) => {
  const { username, password, confirmPassword, csrfToken } = req.body;
  const turnstileToken = req.body["cf-turnstile-response"];

  const renderError = (message) =>
    res.status(400).render("signup", {
      error: message,
      turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
      csrfToken: getOrCreateCsrfToken(req),
    });

  if (!verifyCsrfToken(req, csrfToken)) {
    return renderError("Session expired. Please refresh the page and try again.");
  }

  const turnstileResult = await verifyTurnstile(turnstileToken, req.ip);
  if (!turnstileResult.success) {
    return renderError("Bot verification failed. Please try again.");
  }

  if (!username || !USERNAME_REGEX.test(username)) {
    return renderError(
      "Username must be 4-20 characters and contain only letters, numbers, or underscores."
    );
  }

  if (!password || password.length < 8) {
    return renderError("Password must be at least 8 characters long.");
  }

  if (password !== confirmPassword) {
    return renderError("Passwords do not match.");
  }

  const existing = await db.findUserByUsername(username);
  if (existing) {
    return renderError("That username is already taken.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const newUser = {
    id: uuidv4(),
    username,
    passwordHash,
    balance: 0,
    createdAt: new Date().toISOString(),
  };

  try {
    await db.createUser(newUser);
  } catch (err) {
    if (err.message === "USERNAME_TAKEN") {
      return renderError("That username is already taken.");
    }
    return renderError("Something went wrong. Please try again.");
  }

  // Registration deliberately does not create an authenticated session.
  // The user must prove ownership of the new account through the login flow.
  res.redirect("/login?success=" + encodeURIComponent("Account created successfully! Please log in."));
}));

router.get("/login", redirectIfAuthed, (req, res) => {
  res.render("login", {
    error: null,
    success: req.query.success || null,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
    csrfToken: getOrCreateCsrfToken(req),
  });
});

router.post("/login", authLimiter, redirectIfAuthed, asyncHandler(async (req, res) => {
  const { username, password, csrfToken } = req.body;
  const turnstileToken = req.body["cf-turnstile-response"];

  const renderError = (message) =>
    res.status(400).render("login", {
      error: message,
      success: null,
      turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
      csrfToken: getOrCreateCsrfToken(req),
    });

  if (!verifyCsrfToken(req, csrfToken)) {
    return renderError("Session expired. Please refresh the page and try again.");
  }

  const turnstileResult = await verifyTurnstile(turnstileToken, req.ip);
  if (!turnstileResult.success) {
    return renderError("Bot verification failed. Please try again.");
  }

  if (!username || !password) {
    return renderError("Please enter your username and password.");
  }

  const user = await db.findUserByUsername(username);
  // Constant-shape response whether the user exists or not, to avoid
  // leaking which usernames are registered.
  const passwordHash = user ? user.passwordHash : "$2a$12$invalidinvalidinvalidinvalidinvalidinva";
  const matches = await bcrypt.compare(password, passwordHash);

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (username === adminUsername && password === adminPassword) {
    return req.session.regenerate((err) => {
      if (err) return renderError("Something went wrong. Please try again.");
      req.session.isAdmin = true;
      req.session.role = "admin";
      res.redirect("/dashboard");
    });
  }

  if (!user || !matches || user.banned) {
    return renderError("Invalid username or password.");
  }

  req.session.regenerate((err) => {
    if (err) return renderError("Something went wrong. Please try again.");
    req.session.userId = user.id;
    markActive(user.id);
    db.updateUser(user.id, { lastLoginAt: new Date().toISOString() }).catch(() => {});
    res.redirect("/dashboard");
  });
}));

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;
