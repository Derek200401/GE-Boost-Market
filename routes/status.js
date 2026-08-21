const express = require("express");

const db = require("../lib/db");
const jtsmm = require("../services/jtsmmClient");
const { requireAuth } = require("../middleware/auth");
const { orderLimiter } = require("../middleware/rateLimit");
const { getOrCreateCsrfToken, verifyCsrfToken } = require("../lib/security");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

function mapStatus(rawStatus) {
  const normalized = String(rawStatus || "").toLowerCase();
  if (["completed", "partial"].includes(normalized)) return "DONE";
  if (["in progress", "processing"].includes(normalized)) return "IN PROGRESS";
  if (["pending"].includes(normalized)) return "PENDING";
  if (["canceled", "cancelled"].includes(normalized)) return "PENDING";
  return "PENDING";
}

router.get("/status", requireAuth, asyncHandler(async (req, res) => {
  const orders = (await db.getOrdersByUser(req.currentUser.id)).map((o) => ({
    ...o,
    displayStatus: mapStatus(o.status),
  }));

  const flash = req.session.flash || null;
  delete req.session.flash;

  res.render("status", { orders, flash, csrfToken: getOrCreateCsrfToken(req) });
}));

router.post("/status/refresh", requireAuth, orderLimiter, asyncHandler(async (req, res) => {
  if (!verifyCsrfToken(req, req.body.csrfToken)) {
    req.session.flash = { type: "error", message: "Session expired. Please refresh the page and try again." };
    return res.redirect("/status");
  }
  const orders = await db.getOrdersByUser(req.currentUser.id);
  const pending = orders.filter((o) => mapStatus(o.status) !== "DONE");

  if (pending.length === 0) {
    req.session.flash = { type: "success", message: "All orders are already up to date." };
    return res.redirect("/status");
  }

  try {
    const idsToOrder = new Map(pending.map((o) => [o.jtsmmOrderId, o.id]));
    const result = await jtsmm.getMultipleOrderStatus([...idsToOrder.keys()]);

    if (result && typeof result === "object") {
      for (const [jtsmmOrderId, localOrderId] of idsToOrder.entries()) {
        const entry = result[jtsmmOrderId];
        if (entry && entry.status) {
          await db.updateOrderStatus(localOrderId, entry.status);
        }
      }
    }
    req.session.flash = { type: "success", message: "Boost status updated." };
  } catch (err) {
    req.session.flash = {
      type: "error",
      message: "Could not refresh status right now. Please try again shortly.",
    };
  }

  res.redirect("/status");
}));

module.exports = router;
