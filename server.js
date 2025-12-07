import express from "express";

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
// TABBY WEBHOOK — WITH LOGIC
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

    // ==========================
    // SIMPLE LOGIC ADDED HERE 
    // ==========================
    if (status === "authorized") {
      console.log("Payment authorized → update your system order to PROCESSING");
    }

    if (status === "captured") {
      console.log("Payment captured → update your system order to PAID");
    }

    if (status === "rejected") {
      console.log("Payment rejected → mark order FAILED");
    }

    return res.status(200).send("Tabby Webhook + Logic OK");

  } catch (err) {
    console.error("Tabby Webhook error:", err);
    return res.status(500).send("Webhook Error");
  }
});

// ===============================
// HOME PAGE
// ===============================
app.get("/", (req, res) => {
  res.send("Webhook server is running.");
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
