const db = require("../lib/db");
const asyncHandler = require("./asyncHandler");
const activeUsers = new Map();

function markActive(userId) {
  activeUsers.set(userId, Date.now());
}

function isUserActive(userId) {
  return Date.now() - (activeUsers.get(userId) || 0) < 15 * 60 * 1000;
}

const requireAuth = asyncHandler(async (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    req.currentUser = { id: "admin", username: "Admin", balance: 0, isAdmin: true };
    res.locals.currentUser = req.currentUser;
    return next();
  }
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
  }
  const user = await db.findUserById(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.redirect("/login");
  }
  req.currentUser = user;
  res.locals.currentUser = user;
  markActive(user.id);
  next();
});

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) return res.redirect("/login");
  req.currentUser = { id: "admin", username: "Admin", isAdmin: true, balance: 0 };
  res.locals.currentUser = req.currentUser;
  next();
}

const blockDuringMaintenance = asyncHandler(async (req, res, next) => {
  if (req.session && req.session.isAdmin) return next();
  const db = require("../lib/db");
  if ((await db.getSettings()).maintenanceMode) {
    return res.status(503).render("maintenance", { title: "Maintenance · Hydra Boosting" });
  }
  next();
});

function redirectIfAuthed(req, res, next) {
  if (req.session && (req.session.userId || req.session.isAdmin)) {
    return res.redirect("/dashboard");
  }
  next();
}

module.exports = { requireAuth, requireAdmin, blockDuringMaintenance, redirectIfAuthed, markActive, isUserActive };
