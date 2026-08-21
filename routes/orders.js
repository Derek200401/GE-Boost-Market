const express = require("express");
const { v4: uuidv4 } = require("uuid");

const { getServicesByCategory, getServiceById, CATEGORIES } = require("../config/services");
const db = require("../lib/db");
const jtsmm = require("../services/jtsmmClient");
const { requireAuth } = require("../middleware/auth");
const { verifyCsrfToken } = require("../lib/security");
const { orderLimiter } = require("../middleware/rateLimit");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

const LINK_MAX_LENGTH = 500;

function computeTotal(service, quantity) {
  const raw = (service.pricePer1000 / 1000) * quantity;
  return Math.round(raw * 100) / 100;
}

router.get("/api/services", requireAuth, (req, res) => {
  const category = String(req.query.category || "");
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Unknown category." });
  }
  const services = getServicesByCategory(category).map((s) => ({
    id: s.id,
    name: s.name,
    available: s.available,
  }));
  res.json({ services });
});

router.post("/api/quote", requireAuth, express.json(), (req, res) => {
  const { serviceId, quantity } = req.body || {};
  const service = getServiceById(String(serviceId || ""));

  if (!service) {
    return res.status(400).json({ error: "Unknown service." });
  }
  if (!service.available) {
    return res.status(200).json({ available: false });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(200).json({ available: true, valid: false });
  }

  const withinRange = qty >= service.min && qty <= service.max;
  const total = computeTotal(service, qty);

  res.json({
    available: true,
    valid: withinRange,
    min: service.min,
    max: service.max,
    total: total.toFixed(2),
  });
});

router.post("/orders", requireAuth, orderLimiter, asyncHandler(async (req, res) => {
  const { category, serviceId, link, quantity, csrfToken } = req.body;

  const fail = (message) => {
    req.session.flash = { type: "error", message };
    return res.redirect("/dashboard");
  };

  if (!verifyCsrfToken(req, csrfToken)) {
    return fail("Session expired. Please refresh the page and try again.");
  }

  if (!CATEGORIES.includes(category)) {
    return fail("Please select a valid category.");
  }

  const service = getServiceById(String(serviceId || ""));
  if (!service || service.category !== category) {
    return fail("Please select a valid service.");
  }
  if (!service.available) {
    return fail("This service is currently unavailable.");
  }

  const trimmedLink = String(link || "").trim();
  if (!trimmedLink || trimmedLink.length > LINK_MAX_LENGTH) {
    return fail("Please enter a valid link.");
  }
  if (!/^https?:\/\//i.test(trimmedLink)) {
    return fail("Link must start with http:// or https://");
  }

  const qty = parseInt(quantity, 10);
  if (!Number.isFinite(qty) || qty <= 0) {
    return fail("Please enter a valid quantity.");
  }
  if (qty < service.min || qty > service.max) {
    return fail(
      `Quantity must be between ${service.min} and ${service.max} for this service.`
    );
  }

  const totalCharge = computeTotal(service, qty);

  const currentUser = await db.findUserById(req.session.userId);
  if (!currentUser || Number(currentUser.balance) < totalCharge) {
    return fail("No Credits, recharge first");
  }

  try {
    const providerBalance = await jtsmm.getBalance();
    const available = Number(providerBalance && providerBalance.balance);
    if (!Number.isFinite(available) || available <= 0) {
      return fail("This Service is Unavailable");
    }
  } catch (err) {
    return fail("This Service is Unavailable");
  }

  let deductedUser;
  try {
    deductedUser = await db.deductBalance(currentUser.id, totalCharge);
  } catch (err) {
    if (err.message === "INSUFFICIENT_FUNDS") {
      return fail("No Credits, recharge first");
    }
    return fail("Something went wrong. Please try again.");
  }

  let jtsmmResponse;
  try {
    jtsmmResponse = await jtsmm.placeOrder({
      serviceId: service.serviceId,
      link: trimmedLink,
      quantity: qty,
    });
  } catch (err) {
    await db.refundBalance(currentUser.id, totalCharge);
    return fail("This Service is Unavailable");
  }

  if (!jtsmmResponse || jtsmmResponse.error || !jtsmmResponse.order) {
    await db.refundBalance(currentUser.id, totalCharge);
    return fail("This Service is Unavailable");
  }

  const orderRecord = {
    id: uuidv4(),
    userId: currentUser.id,
    category: service.category,
    serviceName: service.name,
    link: trimmedLink,
    quantity: qty,
    totalCharge,
    jtsmmOrderId: String(jtsmmResponse.order),
    status: "Pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.createOrder(orderRecord);

  req.session.flash = {
    type: "success",
    message: `Order placed successfully for ${service.name}. Total charged: PHP ${totalCharge.toFixed(2)}`,
  };
  res.redirect("/dashboard");
}));

module.exports = router;
