const express = require("express");
const bcrypt = require("bcryptjs");

const db = require("../lib/db");
const { requireAuth } = require("../middleware/auth");
const { getOrCreateCsrfToken, verifyCsrfToken } = require("../lib/security");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.get("/settings", requireAuth, asyncHandler(async (req, res) => {
  const flash = req.session.flash || null;
  delete req.session.flash;

  res.render("settings", {
    csrfToken: getOrCreateCsrfToken(req),
    adminTelegram: process.env.ADMIN_TELEGRAM || "https://t.me/wanitomodzz",
    flash,
  });
}));

router.post("/settings/change-password", requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword, csrfToken } = req.body;

  const fail = (message) => {
    req.session.flash = { type: "error", message };
    return res.redirect("/settings");
  };

  if (!verifyCsrfToken(req, csrfToken)) {
    return fail("Session expired. Please refresh the page and try again.");
  }

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return fail("Please fill in all fields.");
  }

  if (newPassword.length < 8) {
    return fail("New password must be at least 8 characters long.");
  }

  if (newPassword !== confirmNewPassword) {
    return fail("New passwords do not match.");
  }

  const user = await db.findUserById(req.currentUser.id);
  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    return fail("Current password is incorrect.");
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.updateUser(user.id, { passwordHash: newHash });

  req.session.flash = { type: "success", message: "Password updated successfully." };
  res.redirect("/settings");
}));

module.exports = router;
