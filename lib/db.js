const admin = require("firebase-admin");

let usersRef;
let ordersRef;
let settingsRef;
let rootRef;

function getMaxShareableCredits() {
  const configured = process.env.MAX_SHAREABLE_CREDITS;
  if (configured === undefined || configured.trim() === "") return 700;
  if (!/^\d+$/.test(configured.trim())) throw new Error("INVALID_MAX_SHAREABLE_CREDITS");
  const maximum = Number(configured);
  if (!Number.isSafeInteger(maximum) || maximum <= 0) {
    throw new Error("INVALID_MAX_SHAREABLE_CREDITS");
  }
  return maximum;
}

function ensureFirebase() {
  if (usersRef && ordersRef && settingsRef) return;

  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let serviceAccount;

  if (json) {
    try {
      const parsed = JSON.parse(json.trim());
      serviceAccount = {
        projectId: parsed.projectId || parsed.project_id,
        clientEmail: parsed.clientEmail || parsed.client_email,
        privateKey: parsed.privateKey || parsed.private_key,
      };
      if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
        serviceAccount = null;
      }
    } catch {
      serviceAccount = null;
    }
  }
  if (!serviceAccount && (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  )) {
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  if (!databaseURL || !serviceAccount?.projectId || !serviceAccount?.clientEmail || !serviceAccount?.privateKey) {
    throw new Error(
      "Firebase is not configured. Add FIREBASE_DATABASE_URL and either " +
      "FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID, " +
      "FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL,
    });
  }

  rootRef = admin.database().ref("hydra");
  usersRef = rootRef.child("users");
  ordersRef = rootRef.child("orders");
  settingsRef = rootRef.child("settings");
}

const value = async (ref) => (await ref.once("value")).val();

async function findUserByUsername(username) {
  ensureFirebase();
  const users = (await value(usersRef)) || {};
  const normalized = String(username).trim().toLowerCase();
  return Object.values(users).find((u) => u.username.toLowerCase() === normalized) || null;
}
async function findUserById(id) { ensureFirebase(); return (await usersRef.child(id).once("value")).val() || null; }
async function getAllUsers() {
  ensureFirebase();
  return Object.values((await value(usersRef)) || {}).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}
async function createUser(user) {
  ensureFirebase();
  if (await findUserByUsername(user.username)) throw new Error("USERNAME_TAKEN");
  await usersRef.child(user.id).set(user);
  return user;
}
async function updateUser(id, updates) {
  ensureFirebase();
  const current = await findUserById(id);
  if (!current) throw new Error("USER_NOT_FOUND");
  await usersRef.child(id).update(updates);
  return { ...current, ...updates };
}
async function changeBalance(id, amount, mode) {
  ensureFirebase();
  const ref = usersRef.child(id).child("balance");
  let result;
  await ref.transaction((current) => {
    const n = mode === "set" ? Number(amount) : Number(current || 0) + Number(amount);
    if (!Number.isFinite(n) || n < 0) return;
    result = Math.round(n * 100) / 100;
    return result;
  });
  if (result === undefined) throw new Error(mode === "deduct" ? "INSUFFICIENT_FUNDS" : "BAD_BALANCE");
  return updateUser(id, { balance: result });
}
async function deductBalance(id, amount) { return changeBalance(id, -Math.abs(amount), "deduct"); }
async function adjustBalance(id, amount) { return changeBalance(id, amount, "adjust"); }
async function setBalance(id, amount) { return changeBalance(id, amount, "set"); }
async function refundBalance(id, amount) { return changeBalance(id, Math.abs(amount), "adjust"); }

async function getShareableCredits() {
  ensureFirebase();
  const maximum = getMaxShareableCredits();
  let pool;
  const result = await rootRef.child("system/shareableCredits").transaction((current) => {
    if (current === null || current === undefined) {
      pool = maximum;
      return maximum;
    }
    const parsed = Number(current);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > maximum) return;
    pool = parsed;
    return parsed;
  });
  if (!result.committed || pool === undefined) throw new Error("SHAREABLE_POOL_UNAVAILABLE");
  return pool;
}

async function modifyShareableUserBalance(id, amount, mode) {
  ensureFirebase();
  const maximum = getMaxShareableCredits();
  const requested = Number(amount);
  if (!Number.isFinite(requested) || requested < 0 || Math.abs(requested) > 1000000) {
    throw new Error("BAD_AMOUNT");
  }
  if (!["add", "deduct", "set"].includes(mode)) throw new Error("BAD_MODE");

  let operationError;
  let resultUser;
  let resultPool;
  const transaction = await rootRef.transaction((current) => {
    if (!current || !current.users || !current.users[id]) {
      operationError = "USER_NOT_FOUND";
      return;
    }

    const user = current.users[id];
    const currentBalance = Number(user.balance || 0);
    if (!Number.isFinite(currentBalance) || currentBalance < 0) {
      operationError = "BAD_BALANCE";
      return;
    }

    const nextBalance = mode === "set"
      ? requested
      : currentBalance + (mode === "deduct" ? -requested : requested);
    if (!Number.isFinite(nextBalance) || nextBalance < 0) {
      operationError = "INSUFFICIENT_FUNDS";
      return;
    }

    const poolValue = current.system?.shareableCredits;
    const pool = poolValue === undefined || poolValue === null ? maximum : Number(poolValue);
    if (!Number.isFinite(pool) || pool < 0 || pool > maximum) {
      operationError = "SHAREABLE_POOL_UNAVAILABLE";
      return;
    }

    const delta = Math.round((nextBalance - currentBalance) * 100) / 100;
    const nextPool = Math.round((pool - delta) * 100) / 100;
    if (nextPool < 0) {
      operationError = "INSUFFICIENT_SHAREABLE_CREDITS";
      return;
    }

    current.users[id] = { ...user, balance: Math.round(nextBalance * 100) / 100 };
    current.system = { ...(current.system || {}), shareableCredits: Math.min(maximum, nextPool) };
    resultUser = current.users[id];
    resultPool = current.system.shareableCredits;
    return current;
  });

  if (!transaction.committed || operationError || !resultUser || resultPool === undefined) {
    throw new Error(operationError || "SHAREABLE_POOL_UNAVAILABLE");
  }
  return { user: resultUser, shareableCredits: resultPool, maxShareableCredits: maximum };
}

async function createOrder(order) { ensureFirebase(); await ordersRef.child(order.id).set(order); return order; }
async function updateOrder(id, updates) {
  ensureFirebase();
  const order = await getOrderById(id);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  await ordersRef.child(id).update({ ...updates, updatedAt: new Date().toISOString() });
  return { ...order, ...updates };
}
async function getOrdersByUser(userId) {
  ensureFirebase();
  return Object.values((await value(ordersRef)) || {}).filter((o) => o.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
async function getAllOrders() {
  ensureFirebase();
  return Object.values((await value(ordersRef)) || {}).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
async function getOrderById(id) { ensureFirebase(); return (await ordersRef.child(id).once("value")).val() || null; }
async function updateOrderStatus(id, status) {
  ensureFirebase();
  const order = await getOrderById(id); if (!order) return null;
  const updates = { status, updatedAt: new Date().toISOString() };
  await ordersRef.child(id).update(updates); return { ...order, ...updates };
}
async function getSettings() { ensureFirebase(); return { maintenanceMode: Boolean((await value(settingsRef))?.maintenanceMode) }; }
async function updateSettings(updates) { ensureFirebase(); await settingsRef.update(updates); return getSettings(); }

module.exports = { findUserByUsername, findUserById, getAllUsers, createUser, updateUser,
  deductBalance, adjustBalance, setBalance, createOrder, getOrdersByUser, getAllOrders,
  refundBalance, getOrderById, updateOrder, updateOrderStatus, getSettings, updateSettings,
  getMaxShareableCredits, getShareableCredits, modifyShareableUserBalance };