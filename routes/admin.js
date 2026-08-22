const express = require("express");
const db = require("../lib/db");
const { requireAdmin, isUserActive } = require("../middleware/auth");
const { getOrCreateCsrfToken, verifyCsrfToken } = require("../lib/security");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();
router.use("/admin", requireAdmin);

router.get("/admin", asyncHandler(async (req, res) => {
  const flash = req.session.flash || null;
  delete req.session.flash;
  const shareableCredits = await db.getShareableCredits();
  res.render("admin", {
    users: (await db.getAllUsers()).map((user) => ({ ...user, isActive: isUserActive(user.id) })),
    orders: await db.getAllOrders(),
    settings: await db.getSettings(),
    shareableCredits,
    maxShareableCredits: db.getMaxShareableCredits(),
    csrfToken: getOrCreateCsrfToken(req),
    flash,
  });
}));

router.post("/admin/users/:id/balance", asyncHandler(async (req, res) => {
  if (!verifyCsrfToken(req, req.body.csrfToken)) return res.status(403).send("Invalid request");
  const amount = Number(req.body.amount);
  const mode = req.body.mode || "add";
  try {
    const result = await db.modifyShareableUserBalance(req.params.id, amount, mode);
    req.session.flash = { type: "success", message: "Credits updated." };
    if (result.shareableCredits === 0) {
      req.session.flash.message += " The shareable credits pool is now empty.";
    }
  } catch (err) {
    const message = err.message === "INSUFFICIENT_SHAREABLE_CREDITS"
      ? "Insufficient Shareable Credits Pool"
      : err.message === "SHAREABLE_POOL_UNAVAILABLE"
        ? "Shareable Credits Pool is unavailable. No credits were changed."
        : "Could not update credits.";
    req.session.flash = { type: "error", message };
  }
  res.redirect("/admin");
}));

router.post("/admin/users/:id/ban", asyncHandler(async (req, res) => {
  if (!verifyCsrfToken(req, req.body.csrfToken)) return res.status(403).send("Invalid request");
  const user = await db.findUserById(req.params.id);
  if (user) await db.updateUser(user.id, { banned: !user.banned });
  res.redirect("/admin");
}));

router.post("/admin/maintenance", asyncHandler(async (req, res) => {
  if (!verifyCsrfToken(req, req.body.csrfToken)) return res.status(403).send("Invalid request");
  await db.updateSettings({ maintenanceMode: req.body.enabled === "on" });
  res.redirect("/admin");
}));

module.exports = router;