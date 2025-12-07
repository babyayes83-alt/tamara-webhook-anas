import express from "express";

const app = express();
app.use(express.json());

// ===============================
//  Load Environment Variables from Render
// ===============================
const TAMARA_API_KEY = process.env.TAMARA_API_KEY; 
const TAMARA_BASE_URL = process.env.TAMARA_BASE_URL || "https://api-sandbox.tamara.co";

// ===============================
//  TAMARA WEBHOOK → ORDER APPROVED
// ===============================
app.post("/tamara-webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("Webhook received:", event);

    const orderId = event?.order_id;
    const eventType = event?.event_type;

    if (eventType === "order_approved" && orderId) {
      console.log("Order approved, calling Authorise API for order:", orderId);

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

    res.status(200).send("OK");

  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("Webhook error");
  }
});

// ===============================
//  Home Page (Testing)
// ===============================
app.get("/", (req, res) => {
  res.send("Tamara webhook server is running.");
});

// ===============================
//  CANCEL ORDER (Updated Tamara API)
// ===============================
app.post("/cancel", async (req, res) => {
  const { order_id } = req.body;

  try {
    const response = await fetch(`${TAMARA_BASE_URL}/orders/${order_id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAMARA_API_KEY}`
      },
      body: JSON.stringify({
        total_amount: {
          amount: "1",
          currency: "SAR"
        }
      })
    });

    const result = await response.json();
    console.log("Cancel Result:", result);
    res.status(200).json(result);

  } catch (err) {
    console.error("Cancel Error:", err);
    res.status(500).json({ error: "Cancel failed" });
  }
});

// ===============================
//  CAPTURE ORDER
// ===============================
app.post("/capture", async (req, res) => {
  const { order_id, amount } = req.body;

  try {
    const response = await fetch(`${TAMARA_BASE_URL}/orders/${order_id}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAMARA_API_KEY}`
      },
      body: JSON.stringify({
        capture_id: "capture_" + Date.now(),
        amount: {
          amount: amount,
          currency: "SAR"
        }
      })
    });

    const result = await response.json();
    console.log("Capture Result:", result);
    res.status(200).json(result);

  } catch (err) {
    console.error("Capture Error:", err);
    res.status(500).json({ error: "Capture failed" });
  }
});

// ===============================
//  REFUND ORDER
// ===============================
app.post("/refund", async (req, res) => {
  const { order_id, amount } = req.body;

  try {
    const response = await fetch(`${TAMARA_BASE_URL}/orders/${order_id}/refunds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAMARA_API_KEY}`
      },
      body: JSON.stringify({
        refund_id: "refund_" + Date.now(),
        amount: {
          amount: amount,
          currency: "SAR"
        }
      })
    });

    const result = await response.json();
    console.log("Refund Result:", result);
    res.status(200).json(result);

  } catch (err) {
    console.error("Refund Error:", err);
    res.status(500).json({ error: "Refund failed" });
  }
});

// ===============================
//  START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
