import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ===============================
// Environment Variables
// ===============================
const TAMARA_API_KEY = process.env.TAMARA_API_KEY;
const TAMARA_BASE_URL = process.env.TAMARA_BASE_URL || "https://api-sandbox.tamara.co";
const TABBY_SECRET_KEY = process.env.TABBY_SECRET_KEY;

// EasyOrder API Keys
const EASY_TABBY_API_KEY = "86351433-5419-485a-9729-956367eb2f04";
const EASY_TAMARA_API_KEY = "3c532271-37c4-4ecc-a112-1a0bc5ffe31";

const EASYORDER_UPDATE_URL = "https://public-api.easy-orders.net/api/orders";

// ===============================
// Function to update order in EasyOrder
// ===============================
async function updateOrderStatus(orderId, status, paymentMethod, apiKey) {
  try {
    const response = await fetch(`${EASYORDER_UPDATE_URL}/${orderId}/update-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "API-KEY": apiKey
      },
      body: JSON.stringify({
        status: status,
        payment_method: paymentMethod
      })
    });

    const result = await response.json();
    console.log("EasyOrder Update Result:", result);
  } catch (err) {
    console.error("EasyOrder Update Error:", err);
  }
}

// ===============================
// TAMARA WEBHOOK
// ===============================
app.post("/tamara-webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("Tamara Webhook received:", event);

    const orderId = event?.order_reference_id; // EasyOrder رقم الطلب
    const tamaraOrderId = event?.order_id;
    const eventType = event?.event_type;

    if (eventType === "order_approved") {
      console.log("Order Approved — Calling Tamara Authorise API");

      await fetch(`${TAMARA_BASE_URL}/orders/${tamaraOrderId}/authorise`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TAMARA_API_KEY}`
        }
      });

      // تحديث الطلب في EasyOrder
      await updateOrderStatus(orderId, "paid", "tamara", EASY_TAMARA_API_KEY);
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
    console.log("Tabby Webhook received:", event);

    const status = event?.status;
    const orderId = event?.order?.id; // EasyOrder رقم الطلب

    if (!orderId) {
      console.log("Missing order ID");
      return res.status(200).send("No order ID");
    }

    if (status === "authorized" || status === "captured") {
      console.log("Tabby Payment Successful");
      await updateOrderStatus(orderId, "paid", "tabby", EASY_TABBY_API_KEY);
    } 
    else if (status === "rejected" || status === "expired") {
      console.log("Tabby Payment Failed");
      await updateOrderStatus(orderId, "canceled", "tabby", EASY_TABBY_API_KEY);
    }

    return res.status(200).send("Tabby Webhook OK");

  } catch (err) {
    console.error("Tabby Webhook Error:", err);
    return res.status(500).send("Webhook Error");
  }
});

// ===============================
app.get("/", (req, res) => {
  res.send("Webhook server with EasyOrder integration is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
