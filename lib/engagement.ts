import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCart } from "./cart";
import { armNotificationHandler, UVEL_SOUND } from "./push";

const TODAY_ID = "uvel-today-nudge";
const BAG_ID = "uvel-bag-wait";
const FIND_ID = "uvel-first-find";
const CLOSET_ID = "uvel-closet-reminder";
const DAILY_TIMES_KEY_PREFIX = "uvel-engagement-random-times-v1:";
const BAG_REMINDER_KEY_PREFIX = "uvel-engagement-cart-reminder-v1:";

type ReminderTime = { hour: number; minute: number };
type DailyReminderTimes = { main: ReminderTime; firstFind: ReminderTime };
type CartReminderRecord = { signature: string; fireAt: number };
type EngagementOptions = {
  allowed: boolean;
  hasFirstFind: boolean;
  hasClosetItems: boolean;
  uid: string;
  cartSignature: string;
};

const dailyTimesCache = new Map<string, DailyReminderTimes>();
const dailyTimeRequests = new Map<string, Promise<DailyReminderTimes>>();
let syncQueue: Promise<void> = Promise.resolve();

function randomDaytimeTime(): ReminderTime {
  const minuteOfDay = 9 * 60 + Math.floor(Math.random() * 600);
  return { hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 };
}

function minuteOfDay(time: ReminderTime) {
  return time.hour * 60 + time.minute;
}

function isReminderTime(value: unknown): value is ReminderTime {
  if (!value || typeof value !== "object") return false;
  const time = value as ReminderTime;
  return Number.isInteger(time.hour) && time.hour >= 9 && time.hour <= 18 && Number.isInteger(time.minute) && time.minute >= 0 && time.minute <= 59;
}

function makeDailyTimes(): DailyReminderTimes {
  const main = randomDaytimeTime();
  let firstFind = randomDaytimeTime();
  for (let attempt = 0; attempt < 40 && Math.abs(minuteOfDay(main) - minuteOfDay(firstFind)) < 180; attempt += 1) {
    firstFind = randomDaytimeTime();
  }
  if (Math.abs(minuteOfDay(main) - minuteOfDay(firstFind)) < 180) {
    firstFind = minuteOfDay(main) < 13 * 60 ? { hour: 16, minute: Math.floor(Math.random() * 60) } : { hour: 10, minute: Math.floor(Math.random() * 60) };
  }
  return { main, firstFind };
}

function reminderTimes(uid: string): Promise<DailyReminderTimes> {
  const cached = dailyTimesCache.get(uid);
  if (cached) return Promise.resolve(cached);
  const pending = dailyTimeRequests.get(uid);
  if (pending) return pending;
  const request = (async () => {
    const key = `${DAILY_TIMES_KEY_PREFIX}${uid}`;
    const raw = await AsyncStorage.getItem(key).catch(() => null);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Partial<DailyReminderTimes>;
        if (isReminderTime(saved.main) && isReminderTime(saved.firstFind) && Math.abs(minuteOfDay(saved.main) - minuteOfDay(saved.firstFind)) >= 180) {
          const times = { main: saved.main, firstFind: saved.firstFind };
          dailyTimesCache.set(uid, times);
          return times;
        }
      } catch {
        /* regenerate invalid stored times */
      }
    }
    const times = makeDailyTimes();
    await AsyncStorage.setItem(key, JSON.stringify(times)).catch(() => undefined);
    dailyTimesCache.set(uid, times);
    return times;
  })().finally(() => dailyTimeRequests.delete(uid));
  dailyTimeRequests.set(uid, request);
  return request;
}

function cartItemsSignature(items: ReturnType<typeof getCart>) {
  return items.map((item) => `${item.pieceId}:${item.addedAt}`).sort().join("|");
}

function randomDaytimeDate(base: Date, now: Date) {
  const date = new Date(base);
  const time = randomDaytimeTime();
  date.setHours(time.hour, time.minute, 0, 0);
  if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
  return date;
}

function cartReminderDate(now = new Date()) {
  const delayMinutes = 2 * 60 + Math.floor(Math.random() * 240);
  const target = new Date(now.getTime() + delayMinutes * 60_000);
  if (target.getHours() >= 9 && target.getHours() <= 18) return target;
  if (target.getHours() >= 19) target.setDate(target.getDate() + 1);
  return randomDaytimeDate(target, now);
}

function parseCartReminder(raw: string | null): CartReminderRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CartReminderRecord>;
    return typeof value.signature === "string" && typeof value.fireAt === "number" ? { signature: value.signature, fireAt: value.fireAt } : null;
  } catch {
    return null;
  }
}

async function syncBagReminder(N: typeof import("expo-notifications"), opts: EngagementOptions) {
  const items = getCart();
  const key = `${BAG_REMINDER_KEY_PREFIX}${opts.uid}`;
  if (!opts.uid || !items.length) {
    await N.cancelScheduledNotificationAsync(BAG_ID).catch(() => undefined);
    if (opts.uid) await AsyncStorage.removeItem(key).catch(() => undefined);
    return;
  }

  const signature = opts.cartSignature || cartItemsSignature(items);
  const saved = parseCartReminder(await AsyncStorage.getItem(key).catch(() => null));
  const scheduled = await N.getAllScheduledNotificationsAsync().catch(() => []);
  const isScheduled = scheduled.some((request) => request.identifier === BAG_ID);
  if (saved?.signature === signature) {
    // Keep the existing time between refreshes; don't repeat a reminder already delivered for this cart.
    if (saved.fireAt <= Date.now()) return;
    if (isScheduled) return;
    await N.scheduleNotificationAsync({
      identifier: BAG_ID,
      content: {
        title: "Your bag is still here",
        body: "The pieces you picked are waiting.",
        sound: UVEL_SOUND,
        data: { kind: "cart" },
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(saved.fireAt) },
    });
    return;
  }

  await N.cancelScheduledNotificationAsync(BAG_ID).catch(() => undefined);
  const fireAt = cartReminderDate().getTime();
  await AsyncStorage.setItem(key, JSON.stringify({ signature, fireAt })).catch(() => undefined);
  await N.scheduleNotificationAsync({
    identifier: BAG_ID,
    content: {
      title: "Your bag is still here",
      body: "The pieces you picked are waiting.",
      sound: UVEL_SOUND,
      data: { kind: "cart" },
    },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
  });
}

async function notifications() {
  return import("expo-notifications");
}

async function syncEngagementNow(opts: EngagementOptions) {
  try {
    armNotificationHandler();
    const N = await notifications();
    const perm = await N.getPermissionsAsync();
    if (perm.status !== "granted" || !opts.allowed || !opts.uid) {
      await N.cancelScheduledNotificationAsync(TODAY_ID).catch(() => undefined);
      await N.cancelScheduledNotificationAsync(BAG_ID).catch(() => undefined);
      await N.cancelScheduledNotificationAsync(FIND_ID).catch(() => undefined);
      await N.cancelScheduledNotificationAsync(CLOSET_ID).catch(() => undefined);
      if (opts.uid) await AsyncStorage.removeItem(`${BAG_REMINDER_KEY_PREFIX}${opts.uid}`).catch(() => undefined);
      return;
    }

    const times = await reminderTimes(opts.uid);
    const Daily = N.SchedulableTriggerInputTypes.DAILY;
    await N.cancelScheduledNotificationAsync(TODAY_ID).catch(() => undefined);
    await N.cancelScheduledNotificationAsync(CLOSET_ID).catch(() => undefined);
    if (opts.hasClosetItems) {
      await N.scheduleNotificationAsync({
        identifier: CLOSET_ID,
        content: {
          title: "Your Uvel closet is calling",
          body: "Your pieces are still here whenever you’re ready to come back.",
          sound: UVEL_SOUND,
          data: { kind: "closet_reminder" },
        },
        trigger: { type: Daily, hour: times.main.hour, minute: times.main.minute },
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
        trigger: { type: Daily, hour: times.main.hour, minute: times.main.minute },
      });
    }

    await syncBagReminder(N, opts);

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
        trigger: { type: Daily, hour: times.firstFind.hour, minute: times.firstFind.minute },
      });
    }
  } catch {
    /* local nudges are best-effort */
  }
}

export function syncEngagement(opts: EngagementOptions) {
  const task = syncQueue.then(() => syncEngagementNow(opts), () => syncEngagementNow(opts));
  syncQueue = task.then(() => undefined, () => undefined);
  return task;
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
