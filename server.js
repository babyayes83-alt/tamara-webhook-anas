import express from "express";
import fetch from "node-fetch"; // <<< الحل الأساسي

const app = express();
app.use(express.json());

// ===============================
// Environment Variables
// ===============================
const TAMARA_API_KEY = process.env.TAMARA_API_KEY;
const TAMARA_BASE_URL = process.env.TAMARA_BASE_URL || "https://api-sandbox.tamara.co";
const TABBY_SECRET_KEY = process.env.TABBY_SECRET_KEY;

// ===============================
// TAMARA WEBHOOK
// ===============================
app.post("/tamara-webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("Tamara Webhook received:", event);

    const orderId = event?.order_id;
    const eventType = event?.event_type;

    if (eventType === "order_approved" && orderId) {
      console.log("Order approved, calling Authorise API:", orderId);

      const response = await fetch(`${TAMARA_BASE_URL}/orders/${orderId}/authorise`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TAMARA_API_KEY}`
        },
        body: JSON.stringify({})
      });

      const result = await response.json();
      console.log("Authorise result:", result);
    }

    return res.status(200).send("Tamara Webhook OK");
  } catch (err) {
    console.error("Tamara Webhook error:", err);
    return res.status(500).send("Error");
  }
});

// ===============================
// TABBY WEBHOOK
// ===============================
app.post("/tabby-webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("TABBY Webhook received:", event);

    const status = event?.status;
    const paymentId = event?.id;
    const orderId = event?.order?.id;

    console.log("Status:", status);
    console.log("Payment ID:", paymentId);
    console.log("Order ID:", orderId);

    return res.status(200).send("Tabby Webhook OK");
  } catch (err) {
    console.error("Tabby Webhook error:", err);
    return res.status(500).send("Webhook Error");
  }
});

// ===============================
app.get("/", (req, res) => {
  res.send("Webhook server is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
