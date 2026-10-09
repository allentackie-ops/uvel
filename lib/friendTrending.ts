import { firebaseAuth, firebaseReady } from "./firebase";
import { requireSupabase } from "./supabase";

async function currentToken() {
  if (!firebaseReady()) return null;
  const user = firebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}

async function call<T>(body: Record<string, unknown>) {
  const token = await currentToken();
  if (!token) return null;
  const { data, error } = await requireSupabase().functions.invoke("friend-trending", {
    body,
    headers: { "x-firebase-id-token": token },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function recordFriendListingView(listingId: string) {
  if (!listingId) return;
  try {
    await call<{ ok: boolean }>({ action: "record_view", listingId });
  } catch {
    // Friend trends are an enhancement; listing views still work if the trend service is unavailable.
  }
}

export async function fetchFriendTrending(limit = 12) {
  try {
    const result = await call<{ listingIds: string[]; friendCount: number }>({ action: "trending", limit });
    return result || { listingIds: [], friendCount: 0 };
  } catch {
    return { listingIds: [], friendCount: 0 };
  }
}
