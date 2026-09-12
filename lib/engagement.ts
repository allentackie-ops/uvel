import { getCart } from "./cart";
import { armNotificationHandler } from "./push";

const TODAY_ID = "uvel-today-nudge";
const BAG_ID = "uvel-bag-wait";
const FIND_ID = "uvel-first-find";

async function notifications() {
  return import("expo-notifications");
}

export async function syncEngagement(opts: { allowed: boolean; hasBag: boolean; hasFirstFind: boolean }) {
  try {
    armNotificationHandler();
    const N = await notifications();
    const perm = await N.getPermissionsAsync();
    if (perm.status !== "granted" || !opts.allowed) {
      await N.cancelScheduledNotificationAsync(TODAY_ID).catch(() => undefined);
      await N.cancelScheduledNotificationAsync(BAG_ID).catch(() => undefined);
      await N.cancelScheduledNotificationAsync(FIND_ID).catch(() => undefined);
      return;
    }
    const Daily = N.SchedulableTriggerInputTypes.DAILY;
    const Interval = N.SchedulableTriggerInputTypes.TIME_INTERVAL;

    await N.cancelScheduledNotificationAsync(TODAY_ID).catch(() => undefined);
    await N.scheduleNotificationAsync({
      identifier: TODAY_ID,
      content: {
        title: "Today’s floor is up",
        body: "A few pieces landed that look like you.",
        sound: "default",
        data: { kind: "today" },
      },
      trigger: { type: Daily, hour: 11, minute: 0 },
    });

    await N.cancelScheduledNotificationAsync(BAG_ID).catch(() => undefined);
    if (opts.hasBag || getCart().length) {
      await N.scheduleNotificationAsync({
        identifier: BAG_ID,
        content: {
          title: "Your bag is still here",
          body: "The pieces you picked are waiting.",
          sound: "default",
          data: { kind: "cart" },
        },
        trigger: { type: Interval, seconds: 60 * 60 * 3, repeats: false },
      });
    }

    await N.cancelScheduledNotificationAsync(FIND_ID).catch(() => undefined);
    if (opts.hasFirstFind) {
      await N.scheduleNotificationAsync({
        identifier: FIND_ID,
        content: {
          title: "Your First Find is still on the table",
          body: "We’ll cover part of a piece that matches you.",
          sound: "default",
          data: { kind: "first_find" },
        },
        trigger: { type: Daily, hour: 16, minute: 0 },
      });
    }
  } catch {
    /* local nudges are best-effort */
  }
}

export async function pingEnabled() {
  try {
    const N = await notifications();
    await N.scheduleNotificationAsync({
      content: {
        title: "You’re on",
        body: "We’ll ping you when someone writes, a piece sells, or Today has something for you.",
        sound: "default",
        data: { kind: "system" },
      },
      trigger: null,
    });
  } catch {
    /* ignore */
  }
}
