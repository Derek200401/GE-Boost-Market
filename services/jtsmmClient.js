const JTSMM_API_URL =
  process.env.BASE_API_URL ||
  process.env.API_BASE_URL ||
  process.env.JTSMM_API_URL;
const JTSMM_API_KEY = process.env.API_KEY || process.env.JTSMM_API_KEY;

const REQUEST_TIMEOUT_MS = 20000;

async function apiRequest(payload) {
  if (!JTSMM_API_URL || !JTSMM_API_KEY) {
    throw new Error("JTSMM_API_NOT_CONFIGURED");
  }

  const body = new URLSearchParams({ ...payload, key: JTSMM_API_KEY });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(JTSMM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "HydraBoosting-Server/1.0",
        Accept: "application/json",
      },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("JTSMM_HTTP_" + response.status);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function placeOrder({ serviceId, link, quantity }) {
  return apiRequest({
    action: "add",
    service: serviceId,
    link,
    quantity,
  });
}

async function getBalance() {
  return apiRequest({ action: "balance" });
}

async function getOrderStatus(jtsmmOrderId) {
  return apiRequest({ action: "status", order: jtsmmOrderId });
}

async function getMultipleOrderStatus(jtsmmOrderIds) {
  return apiRequest({
    action: "status",
    orders: jtsmmOrderIds.slice(0, 100).join(","),
  });
}

module.exports = {
  placeOrder,
  getBalance,
  getOrderStatus,
  getMultipleOrderStatus,
};
