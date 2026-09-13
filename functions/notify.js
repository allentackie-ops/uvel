async function sendExpoPush(token, title, body, data = {}) {
  if (!token) return;
  const kind = String(data.kind || "");
  const channel = kind === "friend_message" || kind === "listing_message" || kind === "friend_request" || kind === "friend_accepted" ? "social-stitch" : kind === "sold" || kind === "shipped" || kind === "delivered" || kind === "wallet" ? "orders-stitch" : "activity-stitch";
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: token, title, body, sound: "uvel.wav", channelId: channel, priority: "high", data }),
    });
  } catch {
    /* in-app notice still stands if Expo is unreachable */
  }
}

async function notifyUid(db, uid, title, body, data = {}) {
  if (!uid) return;
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return;
  const user = snap.data() || {};
  const kind = String(data.kind || "");
  const marketing = kind === "today" || kind === "first_find" || kind === "cart";
  if (marketing && user.wantsUpdates === false) return;
  await sendExpoPush(user.expoPushToken, title, body, data);
}

module.exports = { sendExpoPush, notifyUid };
