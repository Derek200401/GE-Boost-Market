const express = require("express");
const { getCategories } = require("../config/services");
const { requireAuth } = require("../middleware/auth");
const { getOrCreateCsrfToken } = require("../lib/security");

const router = express.Router();

router.get("/dashboard", requireAuth, (req, res) => {
  const flash = req.session.flash || null;
  delete req.session.flash;

  res.render("dashboard", {
    categories: getCategories(),
    csrfToken: getOrCreateCsrfToken(req),
    flash,
  });
});

module.exports = router;
