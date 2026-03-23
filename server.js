import express from "express";
import fetch from "node-fetch";
import https from "https";

const app = express();
app.use(express.json({ limit: "2mb" }));

const EASYORDER_API_KEY = process.env.EASYORDER_API_KEY;
const TAMARA_API_KEY = process.env.TAMARA_API_KEY;
const TAMARA_BASE_URL = process.env.TAMARA_BASE_URL || "https://api.tamara.co";

const EASYORDER_BASE_URL = "https://public-api.easy-orders.net";

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 1,
});

async function updateEasyOrderStatus(orderId, status) {
  const url = `${EASYORDER_BASE_URL}/orders/${orderId}`;

  const response = await fetch(url, {
    method: "PUT",
    agent,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": EASYORDER_API_KEY,
    },
    body: JSON.stringify({ status }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = await response.text();
  }

  if (!response.ok) {
    throw new Error(`EasyOrder update failed: ${response.status} ${JSON.stringify(data)}`);
  }

  console.log("EasyOrder Update:", data);
  return data;
}

async function authoriseTamaraOrder(orderId) {
  const response = await fetch(`${TAMARA_BASE_URL}/orders/${orderId}/authorise`, {
    method: "POST",
    agent,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TAMARA_API_KEY}`,
    },
    body: JSON.stringify({}),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = await response.text();
  }

  if (!response.ok) {
    throw new Error(`Tamara authorise failed: ${response.status} ${JSON.stringify(data)}`);
  }

  console.log("Tamara Authorise Result:", data);
  return data;
}

app.post("/tamara-webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("TAMARA Webhook:", JSON.stringify(event, null, 2));

    const referenceId = event?.order_reference_id;
    const tamaraOrderId = event?.order_id;
    const type = event?.event_type;

    if (!referenceId || !tamaraOrderId || !type) {
      console.error("Missing required Tamara fields", { referenceId, tamaraOrderId, type });
      return res.status(400).send("Missing required fields");
    }

    if (type === "order_approved") {
      await authoriseTamaraOrder(tamaraOrderId);
      await updateEasyOrderStatus(referenceId, "processing");
      return res.status(200).send("Approved handled");
    }

    if (type === "order_authorised") {
      await updateEasyOrderStatus(referenceId, "completed");
      return res.status(200).send("Authorised handled");
    }

    if (type === "order_declined") {
      await updateEasyOrderStatus(referenceId, "failed");
      return res.status(200).send("Declined handled");
    }

    if (type === "order_cancelled") {
      await updateEasyOrderStatus(referenceId, "cancelled");
      return res.status(200).send("Cancelled handled");
    }

    return res.status(200).send("Unhandled Tamara event");
  } catch (err) {
    console.error("TAMARA Webhook Error:", err);
    return res.status(500).send("Error");
  }
});

app.get("/", (req, res) => {
  res.send("Webhook Server Running...");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
