import express from "express";
import fetch from "node-fetch";
import https from "https";

const app = express();
app.use(express.json({ limit: "2mb" }));

// =============== ENV ===============
const EASYORDER_API_KEY = process.env.EASYORDER_API_KEY;
const TAMARA_API_KEY = process.env.TAMARA_API_KEY;
const TAMARA_BASE_URL = process.env.TAMARA_BASE_URL || "https://api-sandbox.tamara.co";
const TABBY_SECRET_KEY = process.env.TABBY_SECRET_KEY;

const EASYORDER_BASE_URL = "https://public-api.easy-orders.net";

// HTTPS agent (Fix socket hangup)
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 1,
});

// =============== UPDATE EASYORDER ORDER STATUS ===============
async function updateEasyOrderStatus(orderId, status) {
  try {
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

    const data = await response.json();
    console.log("EasyOrder Update:", data);
    return data;

  } catch (err) {
    console.error("EasyOrder Update Error:", err);
  }
}

// ====================== TAMARA WEBHOOK =======================
app.post("/tamara-webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("TAMARA Webhook:", JSON.stringify(event, null, 2));

    const referenceId = event?.order_reference_id; // EasyOrder ID
    const tamaraOrderId = event?.order_id;
    const type = event?.event_type;

    if (!referenceId) {
      return res.status(200).send("Missing reference");
    }

    // 1) order approved → authorize Tamara
    if (type === "order_approved") {
      console.log("TAMARA: Approved → Authorizing...");

      const authRes = await fetch(
        `${TAMARA_BASE_URL}/orders/${tamaraOrderId}/authorise`,
        {
          method: "POST",
          agent,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TAMARA_API_KEY}`,
          },
          body: JSON.stringify({}),
        }
      );

      const result = await authRes.json();
      console.log("Tamara Authorize Result:", result);

      await updateEasyOrderStatus(referenceId, "completed");
      return res.status(200).send("Tamara approved + synced");
    }

    // Declined
    if (type === "order_declined") {
      await updateEasyOrderStatus(referenceId, "failed");
      return res.status(200).send("Tamara declined");
    }

    // Cancelled
    if (type === "order_cancelled") {
      await updateEasyOrderStatus(referenceId, "cancelled");
      return res.status(200).send("Tamara cancelled");
    }

    return res.status(200).send("TAMARA OK");

  } catch (err) {
    console.error("TAMARA Webhook Error:", err);
    res.status(500).send("Error");
  }
});

// ====================== TABBY WEBHOOK =======================
app.post("/tabby-webhook", async (req, res) => {
  try {
    const event = req.body;

    console.log("TABBY Webhook Received:", JSON.stringify(event, null, 2));

    const reference =
      event?.order?.reference_id ||
      event?.reference_id ||
      event?.order?.id;

    if (!reference) {
      return res.status(200).send("Missing reference");
    }

    const status = event?.status;

    // Authorized
    if (status === "authorized") {
      await updateEasyOrderStatus(reference, "processing");
      return res.status(200).send("Tabby authorized");
    }

    // Captured
    if (status === "closed") {  // Tabby = closed
      await updateEasyOrderStatus(reference, "completed");
      return res.status(200).send("Tabby closed → completed");
    }

    // Rejected
    if (status === "rejected") {
      await updateEasyOrderStatus(reference, "failed");
      return res.status(200).send("Tabby rejected");
    }

    // Expired
    if (status === "expired") {
      await updateEasyOrderStatus(reference, "expired");
      return res.status(200).send("Tabby expired");
    }

    return res.status(200).send("Tabby OK");

  } catch (err) {
    console.error("TABBY Webhook Error:", err);
    res.status(500).send("Error");
  }
});

// ====================== ROOT =======================
app.get("/", (req, res) => {
  res.send("Webhook Server Running...");
});

// ====================== RUN =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
