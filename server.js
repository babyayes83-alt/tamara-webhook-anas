import express from "express";

const app = express();
app.use(express.json());

// ===============================
//  Load Environment Variables (Render)
// ===============================
const TAMARA_API_KEY = process.env.TAMARA_API_KEY;
const TAMARA_BASE_URL = process.env.TAMARA_BASE_URL || "https://api-sandbox.tamara.co";

const TABBY_SECRET_KEY = process.env.TABBY_SECRET_KEY;

// ⭐ ضع هنا EasyOrders Public API KEY (الـ ID)
const EASY_ORDERS_API_KEY = "86351433-5419-485a-9729-956367eb2f04";


// =================================================================
// ===========================  TAMARA WEBHOOK  =====================
// =================================================================

app.post("/tamara-webhook", async (req, res) => {
  try {
    const event = req.body;

    console.log("Tamara Webhook received:", event);

    const orderId = event?.order_id;
    const eventType = event?.event_type;

    // 👉 الخطوة 1: عندما توافق تمارا على الطلب order_approved
    if (eventType === "order_approved" && orderId) {

      console.log("Order approved. Calling Authorise API:", orderId);

      const response = await fetch(`${TAMARA_BASE_URL}/orders/${orderId}/authorise`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TAMARA_API_KEY}`
        },
        body: JSON.stringify({})
      });

      const result = await response.json();
      console.log("Tamara Authorise Result:", result);
    }

    res.status(200).send("Tamara Webhook OK");

  } catch (err) {
    console.error("Tamara Webhook Error:", err);
    res.status(500).send("Error");
  }
});


// =================================================================
// ===========================  TABBY WEBHOOK  ======================
// =================================================================

app.post("/tabby-webhook", async (req, res) => {
  try {

    const event = req.body;
    console.log("TABBY Webhook Received:", event);

    const status = event.status;
    const orderId = event.order?.id;

    console.log("Tabby Status:", status);
    console.log("Order ID:", orderId);

    // ⭐ تحديث EasyOrders إذا كانت عملية الدفع ناجحة
    if ((status === "authorized" || status === "captured") && orderId) {

      console.log("Updating EasyOrders → PAID");

      await fetch("https://public-api.easy-orders.net/orders/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${EASY_ORDERS_API_KEY}`
        },
        body: JSON.stringify({
          order_id: orderId,
          payment_status: "paid"
        })
      });

      console.log("EasyOrders updated successfully!");
    }

    res.status(200).send("Tabby Webhook OK");

  } catch (err) {
    console.error("Tabby Webhook Error:", err);
    res.status(500).send("Webhook Error");
  }
});


// =================================================================
// ===================  TABBY STATUS CHECK API  =====================
// =================================================================

app.get("/tabby-status", async (req, res) => {

  const paymentId = req.query.payment_id;

  if (!paymentId) {
    return res.status(400).json({ error: "payment_id is required" });
  }

  try {
    const response = await fetch(`https://api.tabby.ai/api/v2/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${TABBY_SECRET_KEY}`,
        "Content-Type": "application/json",
      }
    });

    const data = await response.json();
    console.log("Tabby Payment Status:", data);

    res.status(200).json(data);

  } catch (err) {
    console.error("Tabby Status Error:", err);
    res.status(500).json({ error: "Unable to fetch payment status" });
  }
});


// =================================================================
// ===================  TABBY CAPTURE | CANCEL | REFUND  ============
// =================================================================

app.post("/tabby-capture", async (req, res) => {
  const { payment_id, amount } = req.body;

  try {
    const response = await fetch(`https://api.tabby.ai/api/v2/payments/${payment_id}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TABBY_SECRET_KEY}`
      },
      body: JSON.stringify({ amount })
    });

    const result = await response.json();
    console.log("Capture Result:", result);
    res.status(200).json(result);

  } catch (err) {
    console.error("Tabby Capture Error:", err);
    res.status(500).json({ error: "Capture Failed" });
  }
});


app.post("/tabby-cancel", async (req, res) => {
  const { payment_id } = req.body;

  try {
    const response = await fetch(`https://api.tabby.ai/api/v2/payments/${payment_id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TABBY_SECRET_KEY}`
      }
    });

    const result = await response.json();
    console.log("Cancel Result:", result);
    res.status(200).json(result);

  } catch (err) {
    console.error("Tabby Cancel Error:", err);
    res.status(500).json({ error: "Cancel Failed" });
  }
});


app.post("/tabby-refund", async (req, res) => {
  const { payment_id, amount } = req.body;

  try {
    const response = await fetch(`https://api.tabby.ai/api/v2/payments/${payment_id}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TABBY_SECRET_KEY}`
      },
      body: JSON.stringify({ amount })
    });

    const result = await response.json();
    console.log("Refund Result:", result);
    res.status(200).json(result);

  } catch (err) {
    console.error("Tabby Refund Error:", err);
    res.status(500).json({ error: "Refund Failed" });
  }
});


// =================================================================
// ===========================  HOME PAGE  ===========================
// =================================================================

app.get("/", (req, res) => {
  res.send("Webhook server is running (Tamara + Tabby + EasyOrders)");
});


// =================================================================
// ===========================  START SERVER  =======================
// =================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
