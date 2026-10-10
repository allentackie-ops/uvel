import { firebaseAuth, firebaseReady } from "./firebase";
import { requireSupabase } from "./supabase";

export type SupabaseStyleDna = {
  archetype: string;
  palette: string;
  silhouette: string;
  styles: string[];
  updatedAt?: string;
};

async function token() {
  if (!firebaseReady()) return null;
  const user = firebaseAuth().currentUser;
  return user ? user.getIdToken() : null;
}

function mapProfile(value: any): SupabaseStyleDna | null {
  if (!value || typeof value !== "object") return null;
  return {
    archetype: typeof value.archetype === "string" ? value.archetype : "",
    palette: typeof value.palette === "string" ? value.palette : "",
    silhouette: typeof value.silhouette === "string" ? value.silhouette : "",
    styles: Array.isArray(value.styles) ? value.styles.filter((item: unknown): item is string => typeof item === "string") : [],
    updatedAt: typeof value.updated_at === "string" ? value.updated_at : undefined,
  };
}

export async function readSupabaseStyleDna(): Promise<SupabaseStyleDna | null> {
  const idToken = await token();
  if (!idToken) return null;
  const { data, error } = await requireSupabase().functions.invoke("style-dna-sync", { body: { action: "read" }, headers: { "x-firebase-id-token": idToken } });
  if (error) throw error;
  return mapProfile(data?.profile);
}

export async function writeSupabaseStyleDna(input: Omit<SupabaseStyleDna, "updatedAt">): Promise<SupabaseStyleDna | null> {
  const idToken = await token();
  if (!idToken) return null;
  const { data, error } = await requireSupabase().functions.invoke("style-dna-sync", { body: { action: "write", ...input }, headers: { "x-firebase-id-token": idToken } });
  if (error) throw error;
  return mapProfile(data?.profile);
}
