import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://cidmigrozwakdreeqhox.supabase.co";
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_rhRaff9du4XcR4KN0bBt-w_4W5PrCqO";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(url && publishableKey);
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url, publishableKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export function requireSupabase() {
  const instance = getSupabase();
  if (!instance) throw new Error("Supabase is not configured for this build.");
  return instance;
}
