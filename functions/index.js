const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const stripeSecret = defineSecret("STRIPE_SECRET");
const paystackSecret = defineSecret("PAYSTACK_SECRET");

const PAYSTACK = new Set(["GH", "NG", "KE", "ZA"]);

exports.createCheckout = onCall({ secrets: [stripeSecret, paystackSecret] }, async (req) => {
  const { amountCents, currency, email, method, country, reference, name } = req.data || {};
  if (!amountCents || !currency || !email) {
    throw new HttpsError("invalid-argument", "Missing amount.");
  }

  if (method !== "apple" && PAYSTACK.has(country)) {
    const key = paystackSecret.value();
    if (!key) throw new HttpsError("failed-precondition", "Paystack isn’t connected yet.");
    const channels =
      method === "momo" || method === "telecel" || method === "mpesa"
        ? ["mobile_money"]
        : method === "card"
          ? ["card"]
          : undefined;
    const r = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: Math.round(amountCents),
        currency,
        reference,
        callback_url: "https://allentackie-ops.github.io/uvel/pay.html",
        channels,
        metadata: { name, country, method },
      }),
    });
    const json = await r.json();
    if (!json.status) throw new HttpsError("internal", json.message || "Paystack failed.");
    return { processor: "paystack", url: json.data.authorization_url, reference };
  }

  const key = stripeSecret.value();
  if (!key) throw new HttpsError("failed-precondition", "Stripe isn’t connected yet.");
  const stripe = require("stripe")(key);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    success_url: "https://allentackie-ops.github.io/uvel/pay.html",
    cancel_url: "https://allentackie-ops.github.io/uvel/pay.html",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: String(currency).toLowerCase(),
          unit_amount: Math.round(amountCents),
          product_data: { name: name || "Uvel order" },
        },
      },
    ],
    payment_method_types: ["card"],
    metadata: { reference, country, method },
  });
  return { processor: "stripe", url: session.url, reference: session.id };
});
