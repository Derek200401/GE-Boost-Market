const express = require("express");
const db = require("../lib/db");
const { requireAdmin, isUserActive } = require("../middleware/auth");
const { getOrCreateCsrfToken, verifyCsrfToken } = require("../lib/security");

const router = express.Router();
router.use("/admin", requireAdmin);

router.get("/admin", async (req, res) => {
  const flash = req.session.flash || null;
  delete req.session.flash;
  res.render("admin", {
    users: (await db.getAllUsers()).map((user) => ({ ...user, isActive: isUserActive(user.id) })),
    orders: await db.getAllOrders(),
    settings: await db.getSettings(),
    csrfToken: getOrCreateCsrfToken(req),
    flash,
  });
});

router.post("/admin/users/:id/balance", async (req, res) => {
  if (!verifyCsrfToken(req, req.body.csrfToken)) return res.status(403).send("Invalid request");
  const amount = Number(req.body.amount);
  const mode = req.body.mode || "add";
  try {
    if (!Number.isFinite(amount) || Math.abs(amount) > 1000000) throw new Error("BAD_AMOUNT");
    if (mode === "set") await db.setBalance(req.params.id, amount);
    else await db.adjustBalance(req.params.id, mode === "deduct" ? -Math.abs(amount) : Math.abs(amount));
    req.session.flash = { type: "success", message: "Credits updated." };
  } catch (err) {
    req.session.flash = { type: "error", message: "Could not update credits." };
  }
  res.redirect("/admin");
});

router.post("/admin/users/:id/ban", async (req, res) => {
  if (!verifyCsrfToken(req, req.body.csrfToken)) return res.status(403).send("Invalid request");
  const user = await db.findUserById(req.params.id);
  if (user) await db.updateUser(user.id, { banned: !user.banned });
  res.redirect("/admin");
});

router.post("/admin/maintenance", async (req, res) => {
  if (!verifyCsrfToken(req, req.body.csrfToken)) return res.status(403).send("Invalid request");
  await db.updateSettings({ maintenanceMode: req.body.enabled === "on" });
  res.redirect("/admin");
});

module.exports = router;