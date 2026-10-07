import { firebaseAuth, firebaseReady } from "./firebase";
import { requireSupabase } from "./supabase";

async function token() {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Sign in before using messaging.");
  return firebaseAuth().currentUser!.getIdToken();
}

export async function marketplaceCall<T = any>(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await requireSupabase().functions.invoke("marketplace-messaging", {
    body: { action, ...payload },
    headers: { "x-firebase-id-token": await token() },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}
