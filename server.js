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
// TABBY WEBHOOK (WITH LOGIC)
// ===============================
app.post("/tabby-webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("TABBY Webhook received:", JSON.stringify(event, null, 2));

    const status = event?.status;
    const paymentId = event?.id;
    const orderId = event?.order?.id;

    console.log("Status:", status);
    console.log("Payment ID:", paymentId);
    console.log("Order ID:", orderId);

    // EasyOrder API Key
    const EASYORDER_API = "86351433-5419-485a-9729-956367eb2f04";

    // Function to update EasyOrder status
    const updateEasyOrder = async (newStatus) => {
      const response = await fetch("https://public-api.easy-orders.net/api/order/change_status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_id: EASYORDER_API,
          order_id: orderId,
          status: newStatus
        })
      });

      const data = await response.json();
      console.log("EasyOrder Update Response:", data);
    };

    // Apply Logic Based on Tabby Status
    switch (status) {
      case "authorized":
        console.log("Payment Authorized → Marking order as processing");
        await updateEasyOrder("processing");
        break;

      case "captured":
        console.log("Payment Captured → Marking order completed");
        await updateEasyOrder("completed");
        break;

      case "rejected":
        console.log("Payment Rejected → Cancelling order");
        await updateEasyOrder("cancelled");
        break;

      case "voided":
      case "expired":
        console.log("Payment voided/expired → Cancelling order");
        await updateEasyOrder("cancelled");
        break;

      case "refunded":
        console.log("Payment refunded → Marking as refunded");
        await updateEasyOrder("refunded");
        break;

      default:
        console.log("Unknown status → No action");
    }

    return res.status(200).send("Tabby Webhook + Logic OK");

  } catch (err) {
    console.error("Tabby Webhook error:", err);
    return res.status(500).send("Webhook Error");
  }
});

// ===============================
// Root Endpoint
// ===============================
app.get("/", (req, res) => {
  res.send("Webhook server is running.");
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
