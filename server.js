import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ===============================
// Environment Variables
// ===============================
const TABBY_SECRET_KEY = process.env.TABBY_SECRET_KEY;

// ========== EasyOrder API ==========
const EASYORDER_API_KEY = "86351433-5419-485a-9729-956367eb2f04"; // tabby API-Key
const EASYORDER_BASE_URL = "https://public-api.easy-orders.net";

// ===============================
// Update Order Status in EasyOrder
// ===============================
async function updateEasyOrderStatus(orderId, status) {
  try {
    const url = `${EASYORDER_BASE_URL}/orders/${orderId}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": EASYORDER_API_KEY
      },
      body: JSON.stringify({ status })
    });

    const data = await response.json();
    console.log("EasyOrder Update Response:", data);
  } catch (err) {
    console.error("Error updating EasyOrder:", err);
  }
}

// ===============================
// TABBY → WEBHOOK
// ===============================
app.post("/tabby-webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("TABBY Webhook received:", event);

    const paymentStatus = event?.status;
    const paymentId = event?.id;
    const orderId = event?.order?.id; // Order number from your store

    console.log("Status:", paymentStatus);
    console.log("Order ID:", orderId);

    // ========== MAP TABBY → EASYORDER ==========
    const statusMap = {
      authorized: "في انتظار الدفع",
      captured: "تم الدفع",
      rejected: "فشل الدفع",
      voided: "تم إلغاء الطلب",
      cancelled: "تم إلغاء الطلب",
      refunded: "تم الإرجاع"
    };

    const easyOrderStatus = statusMap[paymentStatus];

    if (easyOrderStatus && orderId) {
      console.log("Updating EasyOrder to:", easyOrderStatus);
      await updateEasyOrderStatus(orderId, easyOrderStatus);
    }

    return res.status(200).send("Tabby Webhook + EasyOrder Sync: OK");
  } catch (err) {
    console.error("Tabby Webhook error:", err);
    return res.status(500).send("Webhook Error");
  }
});

// ===============================
app.get("/", (req, res) => {
  res.send("Webhook server is running + EasyOrder Sync Enabled.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
