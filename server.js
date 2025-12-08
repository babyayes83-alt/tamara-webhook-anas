import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ===============================
// Environment Variables
// ===============================
const TAMARA_API_KEY = process.env.TAMARA_API_KEY;
const TAMARA_BASE_URL =
  process.env.TAMARA_BASE_URL || "https://api-sandbox.tamara.co";

const TABBY_SECRET_KEY = process.env.TABBY_SECRET_KEY;

// ===============================
// EasyOrder API
// ===============================
const EASYORDER_API_KEY = "86351433-5419-485a-9729-956367eb2f04";
const EASYORDER_BASE_URL = "https://public-api.easy-orders.net";

async function updateEasyOrderStatus(orderId, status) {
  try {
    const url = `${EASYORDER_BASE_URL}/orders/${orderId}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": EASYORDER_API_KEY,
      },
      body: JSON.stringify({ status }),
    });

    const data = await response.json();
    console.log("EasyOrder Update Response:", data);

    return data;
  } catch (err) {
    console.error("EasyOrder Update Error:", err);
  }
}

// ===============================================================
// TAMARA WEBHOOK
// ===============================================================
app.post("/tamara-webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("Tamara Webhook received:", event);

    const orderId = event?.order_id;
    const reference = event?.order_reference_id; // EasyOrder orderId
    const eventType = event?.event_type;

    if (!reference) {
      console.log("Tamara: Missing EasyOrder reference_id");
      return res.status(200).send("Missing reference_id");
    }

    if (eventType === "order_approved") {
      console.log("TAMARA: Payment approved → Authorizing...");

      const response = await fetch(
        `${TAMARA_BASE_URL}/orders/${orderId}/authorise`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TAMARA_API_KEY}`,
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();
      console.log("Tamara Authorise Result:", result);

      await updateEasyOrderStatus(reference, "completed");

      return res.status(200).send("Tamara Approved + Synced");
    }

    if (eventType === "order_declined") {
      await updateEasyOrderStatus(reference, "failed");
      return res.status(200).send("Tamara Declined + Synced");
    }

    if (eventType === "order_cancelled") {
      await updateEasyOrderStatus(reference, "cancelled");
      return res.status(200).send("Tamara Cancelled + Synced");
    }

    return res.status(200).send("Tamara Webhook OK");
  } catch (err) {
    console.error("Tamara Webhook Error:", err);
    return res.status(500).send("Error");
  }
});

// ===============================================================
// TABBY WEBHOOK
// ===============================================================
app.post("/tabby-webhook", async (req, res) => {
  try {
    const event = req.body;

    console.log("TABBY Webhook received:", JSON.stringify(event, null, 2));

    // استخراج رقم الطلب الصحيح من Tabby
    const reference =
      event?.reference_id ||           // old format
      event?.order?.reference_id ||    // correct official format
      event?.order?.id;                // last fallback

    if (!reference) {
      console.log("Tabby: Missing reference_id (EasyOrder order ID)");
      return res.status(200).send("Missing reference_id");
    }

    const status = event?.status;

    // Authorized
    if (status === "authorized") {
      console.log("TABBY: Payment authorized → PROCESSING");
      await updateEasyOrderStatus(reference, "processing");
      return res.status(200).send("Tabby Authorized + Synced");
    }

    // Captured
    if (status === "captured") {
      console.log("TABBY: Payment captured → COMPLETED");
      await updateEasyOrderStatus(reference, "completed");
      return res.status(200).send("Tabby Captured + Synced");
    }

    // Rejected
    if (status === "rejected") {
      await updateEasyOrderStatus(reference, "failed");
      return res.status(200).send("Tabby Rejected + Synced");
    }

    // Expired
    if (status === "expired") {
      await updateEasyOrderStatus(reference, "expired");
      return res.status(200).send("Tabby Expired + Synced");
    }

    return res.status(200).send("Tabby Webhook OK");
  } catch (err) {
    console.error("Tabby Webhook Error:", err);
    return res.status(500).send("Webhook Error");
  }
});

// ===============================================================
// SERVER ROOT
// ===============================================================
app.get("/", (req, res) => {
  res.send("Webhook server is running.");
});

// ===============================================================
// RUN SERVER
// ===============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
