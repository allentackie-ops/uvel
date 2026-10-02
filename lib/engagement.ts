import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCart } from "./cart";
import { armNotificationHandler, UVEL_SOUND } from "./push";

const TODAY_ID = "uvel-today-nudge";
const BAG_ID = "uvel-bag-wait";
const FIND_ID = "uvel-first-find";
const CLOSET_ID = "uvel-closet-reminder";
const CLOSET_TIME_PREFIX = "uvel-closet-reminder-time-v1:";
const randomTimeRequests = new Map<string, Promise<{ hour: number; minute: number }>>();

function closetReminderTime(uid: string) {
  const pending = randomTimeRequests.get(uid);
  if (pending) return pending;
  const request = (async () => {
    const key = `${CLOSET_TIME_PREFIX}${uid}`;
    const saved = await AsyncStorage.getItem(key).catch(() => null);
    if (saved) {
      const [hour, minute] = saved.split(":").map(Number);
      if (Number.isInteger(hour) && hour >= 9 && hour <= 18 && Number.isInteger(minute) && minute >= 0 && minute <= 59) {
        return { hour, minute };
      }
    }
    // Spread opted-in account reminders through daytime and avoid quiet hours.
    const time = { hour: 9 + Math.floor(Math.random() * 10), minute: Math.floor(Math.random() * 60) };
    await AsyncStorage.setItem(key, `${time.hour}:${time.minute}`).catch(() => undefined);
    return time;
  })().finally(() => randomTimeRequests.delete(uid));
  randomTimeRequests.set(uid, request);
  return request;
}

async function notifications() {
  return import("expo-notifications");
}

export async function syncEngagement(opts: { allowed: boolean; hasBag: boolean; hasFirstFind: boolean; hasClosetItems: boolean; uid: string }) {
  try {
    armNotificationHandler();
    const N = await notifications();
    const perm = await N.getPermissionsAsync();
    if (perm.status !== "granted" || !opts.allowed) {
      await N.cancelScheduledNotificationAsync(TODAY_ID).catch(() => undefined);
      await N.cancelScheduledNotificationAsync(BAG_ID).catch(() => undefined);
      await N.cancelScheduledNotificationAsync(FIND_ID).catch(() => undefined);
      await N.cancelScheduledNotificationAsync(CLOSET_ID).catch(() => undefined);
      return;
    }
    const Daily = N.SchedulableTriggerInputTypes.DAILY;
    const Interval = N.SchedulableTriggerInputTypes.TIME_INTERVAL;

    await N.cancelScheduledNotificationAsync(TODAY_ID).catch(() => undefined);
    await N.cancelScheduledNotificationAsync(CLOSET_ID).catch(() => undefined);
    if (opts.hasClosetItems && opts.uid) {
      const time = await closetReminderTime(opts.uid);
      await N.scheduleNotificationAsync({
        identifier: CLOSET_ID,
        content: {
          title: "Your Uvel closet is calling",
          body: "Your pieces are still here whenever you’re ready to come back.",
          sound: UVEL_SOUND,
          data: { kind: "closet_reminder" },
        },
        trigger: { type: Daily, hour: time.hour, minute: time.minute },
      });
    } else {
      await N.scheduleNotificationAsync({
        identifier: TODAY_ID,
        content: {
          title: "Today’s store is up 🛍️",
          body: "A few pieces landed that look like you.",
          sound: UVEL_SOUND,
          data: { kind: "today" },
        },
        trigger: { type: Daily, hour: 11, minute: 0 },
      });
    }

    await N.cancelScheduledNotificationAsync(BAG_ID).catch(() => undefined);
    if (opts.hasBag || getCart().length) {
      await N.scheduleNotificationAsync({
        identifier: BAG_ID,
        content: {
          title: "Your bag is still here",
          body: "The pieces you picked are waiting.",
          sound: UVEL_SOUND,
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
          sound: UVEL_SOUND,
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
        sound: UVEL_SOUND,
        data: { kind: "system" },
      },
      trigger: null,
    });
  } catch {
    /* ignore */
  }
}
