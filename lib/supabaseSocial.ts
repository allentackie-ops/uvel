import { firebaseAuth, firebaseReady } from "./firebase";
import { readUserProfile } from "./auth";
import { requireSupabase } from "./supabase";
import type { PublicUser } from "./friends";

export type SocialNotification = { id: string; kind: "friend_request" | "friend_accepted" | "friend_added"; requestId: string; actor: PublicUser; readAt?: unknown; createdAt?: unknown };

async function currentToken() {
  if (!firebaseReady()) throw new Error("Sign in before using social features.");
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error("Sign in before using social features.");
  return { user, token: await user.getIdToken() };
}

export async function syncSocialProfile() {
  const { user, token } = await currentToken();
  const saved = await readUserProfile(user.uid);
  const { data, error } = await requireSupabase().functions.invoke("firebase-social-gateway", {
    body: { action: "sync_profile", profile: { username: saved?.username || "", displayName: saved?.name || user.displayName || "" } },
    headers: { "x-firebase-id-token": token },
  });
  if (error) throw error;
  return data?.profile as PublicUser;
}

export async function uploadProfileAvatarToSupabase(base64: string): Promise<string> {
  const { token } = await currentToken();
  const { data, error } = await requireSupabase().functions.invoke("firebase-social-gateway", {
    body: { action: "upload_profile_avatar", contentType: "image/jpeg", base64 },
    headers: { "x-firebase-id-token": token },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (typeof data?.avatarUri !== "string" || !data.avatarUri.includes("/storage/v1/object/public/profile-avatars/")) {
    throw new Error("Supabase did not return a profile-avatar URL.");
  }
  return data.avatarUri;
}

export async function socialCall<T = any>(action: string, payload: Record<string, unknown> = {}) {
  const { token } = await currentToken();
  const { data, error } = await requireSupabase().functions.invoke("firebase-social-gateway", {
    body: { action, ...payload },
    headers: { "x-firebase-id-token": token },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function searchSupabaseUsers(term: string) {
  await syncSocialProfile();
  const result = await socialCall<{ users: PublicUser[] }>("search_users", { term });
  return result.users || [];
}

export async function mirrorSocialProfiles(users: PublicUser[]) {
  try {
    const { token } = await currentToken();
    await requireSupabase().functions.invoke("firebase-social-profile-import", {
      body: { profiles: users.slice(0, 20) },
      headers: { "x-firebase-id-token": token },
    });
  } catch { /* Firebase remains the fallback profile source during migration. */ }
}

export function pollSocial<T>(load: () => Promise<T>, callback: (value: T) => void, intervalMs: number, onError?: (error: unknown) => void) {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let nextDelay = intervalMs;

  // Schedule the next poll only after this one settles. A slow request should
  // never cause a second request to pile up behind it.
  const refresh = async () => {
    try {
      const value = await load();
      if (!active) return;
      callback(value);
      nextDelay = intervalMs;
    } catch (error) {
      if (!active) return;
      onError?.(error);
      nextDelay = Math.min(30_000, Math.max(intervalMs * 2, nextDelay * 2));
    } finally {
      if (active) timer = setTimeout(() => void refresh(), nextDelay);
    }
  };

  void refresh();
  return () => {
    active = false;
    if (timer) clearTimeout(timer);
  };
}
