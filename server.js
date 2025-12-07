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
const EASYORDER_API_KEY = "86351433-5419-485a-9729-956367eb2f04"; // tamara API key
const EASYORDER_BASE_URL = "https://public-api.easy-orders.net";

// Update order status in EasyOrder
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

// ===================================================================
// TAMARA WEBHOOK
// ===================================================================
app.post("/tamara-webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("Tamara Webhook received:", event);

    const orderId = event?.order_id;
    const eventType = event?.event_type;
    const reference = event?.order_reference_id; // EasyOrder ID (your system)

    if (!reference) {
      console.log("No EasyOrder ID sent from Tamara");
      return res.status(200).send("No reference");
    }

    // ============ حالات تمارا ============

    if (eventType === "order_approved") {
      console.log("TAMARA: order approved, authorizing payment...");

      // Call Authorise API
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
      console.log("TAMARA Authorise result:", result);

      // Update EasyOrder → COMPLETED
      await updateEasyOrderStatus(reference, "completed");
      return res.status(200).send("Tamara Approved + Synced");
    }

    if (eventType === "order_declined") {
      console.log("TAMARA: Payment declined");

      await updateEasyOrderStatus(reference, "failed");
      return res.status(200).send("Tamara Declined + Synced");
    }

    if (eventType === "order_cancelled") {
      console.log("TAMARA: Order cancelled");

      await updateEasyOrderStatus(reference, "cancelled");
      return res.status(200).send("Tamara Cancelled + Synced");
    }

    return res.status(200).send("Tamara Webhook OK");
  } catch (err) {
    console.error("Tamara Webhook error:", err);
    return res.status(500).send("Error");
  }
});

// ===================================================================
// TABBY WEBHOOK
// ===================================================================
app.post("/tabby-webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("TABBY Webhook received:", event);

    const status = event?.status;
    const orderId = event?.order?.id; // EasyOrder ID (your system)

    if (!orderId) {
      console.log("Tabby: No EasyOrder Order ID found");
      return res.status(200).send("Missing order ID");
    }

    // ============ حالات تابي ============

    if (status === "authorized") {
      console.log("TABBY: Payment authorized → set to PROCESSING");

      await updateEasyOrderStatus(orderId, "processing");
      return res.status(200).send("Tabby Authorized + Synced");
    }

    if (status === "captured") {
      console.log("TABBY: Payment captured → COMPLETED");

      await updateEasyOrderStatus(orderId, "completed");
      return res.status(200).send("Tabby Captured + Synced");
    }

    if (status === "rejected") {
      console.log("TABBY: Payment rejected");

      await updateEasyOrderStatus(orderId, "failed");
      return res.status(200).send("Tabby Rejected + Synced");
    }

    if (status === "expired") {
      console.log("TABBY: Payment expired");

      await updateEasyOrderStatus(orderId, "expired");
      return res.status(200).send("Tabby Expired + Synced");
    }

    return res.status(200).send("Tabby Webhook OK");
  } catch (err) {
    console.error("Tabby Webhook error:", err);
    return res.status(500).send("Webhook Error");
  }
});

// ===================================================================
app.get("/", (req, res) => {
  res.send("Webhook server is running.");
});

// ===================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
