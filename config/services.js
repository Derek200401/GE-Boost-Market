/**
 * Fixed service catalog for Hydra Boosting.
 *
 * Only the entries below with `available: true` can actually be
 * ordered. Entries with `available: false` are shown in the UI as
 * "Unavailable" so users can see the platform exists without being
 * able to place an order against a service that has no fixed price
 * or JTSMM service ID assigned yet.
 *
 * `serviceId` maps directly to the JTSMM Panel `service` parameter.
 * `pricePer1000` is the fixed retail price in PHP charged to the
 * website's users, independent of whatever the upstream JTSMM rate
 * actually is. This price and the JTSMM service ID are never sent
 * to the browser -- only the category/service name and the
 * calculated total appear on the client.
 */

const CATEGORIES = ["Instagram", "Tiktok", "Facebook", "Telegram"];
const MIN_QUANTITY = 3000;
const MAX_QUANTITY = 1000000;

const SERVICES = [
  // ---------------------------- Facebook ----------------------------
  {
    id: "fb-followers",
    category: "Facebook",
    name: "Facebook 1000 Followers",
    serviceId: 754,
    pricePer1000: 60,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
  {
    id: "fb-views",
    category: "Facebook",
    name: "Facebook 1000 Views",
    serviceId: 6578,
    pricePer1000: 8,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
  {
    id: "fb-heart-react",
    category: "Facebook",
    name: "Facebook 1000 Likes React",
    serviceId: 6158,
    pricePer1000: 15,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
  {
    id: "fb-wow-react",
    category: "Facebook",
    id: "fb-haha-react",
    category: "Facebook",
    name: "Facebook 1000 Haha React",
    serviceId: 6162,
    pricePer1000: 15,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
  {
    id: "fb-sad-react",
    category: "Facebook",
    name: "Facebook 1000 Sad React",
    serviceId: 6163,
    pricePer1000: 15,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
  {
    id: "fb-angry-react",
    category: "Facebook",
    name: "Facebook 1000 Angry React",
    serviceId: 6164,
    pricePer1000: 15,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },

  // ---------------------------- Instagram ----------------------------
  {
    id: "ig-followers",
    category: "Instagram",
    name: "Instagram 1000 Followers",
    serviceId: 6764,
    pricePer1000: 40,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
  {
    id: "ig-views",
    category: "Instagram",
    name: "Instagram 1000 Views",
    serviceId: 6218,
    pricePer1000: 10,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
  {
    id: "ig-likes",
    category: "Instagram",
    name: "Instagram 1000 Likes",
    serviceId: 584,
    pricePer1000: 15,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },

  // ---------------------------- Telegram ----------------------------
  {
    id: "tg-members",
    category: "Telegram",
    name: "Telegram 1000 Member",
    serviceId: 3804,
    pricePer1000: 70,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
  {
    id: "tg-post-view",
    category: "Telegram",
    name: "Telegram 1000 Views",
    serviceId: 5270,
    pricePer1000: 10,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
  {
    id: "tg-post-react",
    category: "Telegram",
    name: "Telegram 1000 Positive React (FREE VIEWS)",
    serviceId: 3974,
    pricePer1000: 25,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },

  // ----------------------------- Tiktok -----------------------------
  {
    id: "tt-followers",
    category: "Tiktok",
    name: "Tiktok 1000 Followers",
    serviceId: 5857,
    pricePer1000: 90,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
  {
    id: "tt-views",
    category: "Tiktok",
    name: "Tiktok 1000 Views",
    serviceId: 6170,
    pricePer1000: 8,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
  {
    id: "tt-comments",
    category: "Tiktok",
    name: "Tiktok 1000 Comment",
    serviceId: process.env.TIKTOK_COMMENT_SERVICE_ID || null,
    pricePer1000: Number(process.env.TIKTOK_COMMENT_PRICE || 0) || null,
    available: Boolean(process.env.TIKTOK_COMMENT_SERVICE_ID && process.env.TIKTOK_COMMENT_PRICE),
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
  {
    id: "tt-likes",
    category: "Tiktok",
    name: "Tiktok 1000 Likes",
    serviceId: 5309,
    pricePer1000: 15,
    available: true,
    min: MIN_QUANTITY,
    max: MAX_QUANTITY,
  },
];

function getCategories() {
  return CATEGORIES;
}

function getServicesByCategory(category) {
  return SERVICES.filter((s) => s.category === category);
}

function getServiceById(id) {
  return SERVICES.find((s) => s.id === id) || null;
}

module.exports = {
  CATEGORIES,
  SERVICES,
  getCategories,
  getServicesByCategory,
  getServiceById,
  MIN_QUANTITY,
};
