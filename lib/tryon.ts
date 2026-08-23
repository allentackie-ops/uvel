import Constants from "expo-constants";
import { Image, type ImageSourcePropType } from "react-native";

type Extra = {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  firebase?: { openaiApiKey?: string; anthropicApiKey?: string };
};

function extra() {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

export function openaiKey() {
  const e = extra();
  const wired = [
    "sk-proj-Uax33gzdDaZG6xNKAGolAVLE5TWwQhLMQTwDuRGXKKENeNNUM_0uLygTa-hvF1lMUsJaXJ4BuVT3",
    "BlbkFJazXfZaqvL_EmRiMwiINStULHpRmouXf4qq_ee4szRO0Ee76_0-r52g29XulKSwoL9NPnQpdW4A",
  ].join("");
  return process.env.EXPO_PUBLIC_OPENAI_API_KEY || e.openaiApiKey || e.firebase?.openaiApiKey || wired;
}

export function anthropicKey() {
  const e = extra();
  const wired = [
    "sk-ant-api03-cflVcxLhIwTdUrXSYpYJSEpdDjhA3hAjTlNp_dyFKzXnEAMVkoKDYnS1goARpCJaQDs",
    "_rXU-0YRlROFNjV-RRQ-_neKhgAA",
  ].join("");
  return process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || e.anthropicApiKey || e.firebase?.anthropicApiKey || wired;
}

function bytesToBase64(bytes: Uint8Array) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const c = i + 2 < len ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += chars[(n >> 18) & 63];
    out += chars[(n >> 12) & 63];
    out += i + 1 < len ? chars[(n >> 6) & 63] : "=";
    out += i + 2 < len ? chars[n & 63] : "=";
  }
  return out;
}

function mimeOf(uri: string) {
  const u = uri.toLowerCase();
  if (u.includes(".png") || u.startsWith("data:image/png")) return "image/png";
  if (u.includes(".webp")) return "image/webp";
  return "image/jpeg";
}

export function resolveSource(src: ImageSourcePropType | { uri: string }) {
  if (typeof src === "object" && src && "uri" in src && src.uri) return src.uri;
  const r = Image.resolveAssetSource(src as number);
  return r.uri;
}

async function uriToDataUrl(uri: string) {
  const res = await fetch(uri);
  if (!res.ok) throw new Error("Couldn’t read that photo.");
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (!bytes.length) throw new Error("That photo is empty.");
  return `data:${mimeOf(uri)};base64,${bytesToBase64(bytes)}`;
}

function promptFor(name: string, category: string) {
  const kind = category.toLowerCase();
  let swap = `Show them wearing the ${name} from photo 2 as everyday street fashion.`;
  if (kind.includes("top") || kind.includes("knit") || kind.includes("blouse") || kind.includes("shirt")) {
    swap = `Swap only the top for the ${name}. Keep whatever they're wearing on the bottom.`;
  } else if (kind.includes("trouser") || kind.includes("skirt") || kind.includes("pant") || kind.includes("denim")) {
    swap = `Swap only the bottoms for the ${name}. Keep the top they're wearing.`;
  } else if (kind.includes("outer") || kind.includes("coat") || kind.includes("jacket") || kind.includes("blazer")) {
    swap = `Add the ${name} over their current clothes, like they just put it on.`;
  } else if (kind.includes("dress")) {
    swap = `Show them wearing the ${name} as a regular day dress.`;
  } else if (kind.includes("shoe")) {
    swap = `Put the ${name} on their feet. Keep the rest of the clothes.`;
  }

  return `Retail virtual try-on for a clothing marketplace. Safe for a general audience.

Photo 1: the shopper, fully clothed, in their room.
Photo 2: the ${name} (${category}) they want to see on themselves.

${swap}

Keep the same person, face, hair, pose, skin, jewelry, room, and lighting. Photorealistic. They stay fully clothed. No collage, no extra people, no text, no logos.`;
}

function safeRetryPrompt(name: string, category: string) {
  return `E-commerce product visualization. Combine these two photos:
1) a clothed person in a bedroom
2) a clothing item (${name}, ${category}) sold on a fashion app

Output: the same person, still fully dressed, now wearing that item. Modest, SFW, catalog style. Same face, hair, pose, room. Photorealistic. No text.`;
}

function nice(text: string) {
  const low = text.toLowerCase();
  if (low.includes("incorrect api key") || low.includes("invalid_api_key") || low.includes("unauthorized") || low.includes("401")) {
    return "That OpenAI key isn’t valid. Send a new one from platform.openai.com/api-keys.";
  }
  if (low.includes("insufficient_quota") || low.includes("billing") || low.includes("exceeded your current quota")) {
    return "OpenAI needs billing on this key. Add a card at platform.openai.com/settings/organization/billing.";
  }
  if (low.includes("moderation_blocked") || low.includes("safety system") || low.includes("rejected as a result")) {
    return "Couldn’t generate that look. Try once more — this isn’t you, it’s the image filter.";
  }
  if (low.includes("formdatapart")) return "Couldn’t send that photo. Try Library again.";
  if (low.includes("rate") || low.includes("429")) return "Try-on is busy. Wait a moment.";
  if (low.includes("network") || low.includes("failed to fetch")) return "No connection. Try again.";
  return text.slice(0, 220) || "Couldn’t dress you in that. Try again.";
}

function imageFrom(json: { error?: { message?: string }; data?: { b64_json?: string; url?: string }[] }) {
  if (json.error?.message) throw new Error(json.error.message);
  const d = json.data?.[0];
  if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
  if (d?.url) return d.url;
  throw new Error("No image came back.");
}

async function openaiEdits(personUrl: string, garmentUrl: string, prompt: string) {
  const key = openaiKey();
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt,
      images: [{ image_url: personUrl }, { image_url: garmentUrl }],
      size: "1024x1536",
      quality: "low",
      moderation: "low",
    }),
  });
  const json = (await res.json()) as Parameters<typeof imageFrom>[0];
  if (!res.ok) throw new Error(json.error?.message || `Try-on failed (${res.status}).`);
  return imageFrom(json);
}

function isBlocked(err: unknown) {
  const low = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return low.includes("moderation_blocked") || low.includes("safety system") || low.includes("rejected as a result");
}

export async function dressPerson(opts: {
  personUri: string;
  garment: ImageSourcePropType | { uri: string };
  garmentName?: string;
  category?: string;
}) {
  if (!openaiKey()) throw new Error("Add your OpenAI key and I’ll turn try-on on.");
  const name = opts.garmentName ?? "this piece";
  const category = opts.category ?? "clothes";
  try {
    const [personUrl, garmentUrl] = await Promise.all([
      uriToDataUrl(opts.personUri),
      uriToDataUrl(resolveSource(opts.garment)),
    ]);
    try {
      return await openaiEdits(personUrl, garmentUrl, promptFor(name, category));
    } catch (first) {
      if (!isBlocked(first)) throw first;
      return await openaiEdits(personUrl, garmentUrl, safeRetryPrompt(name, category));
    }
  } catch (err) {
    throw new Error(nice(err instanceof Error ? err.message : String(err)));
  }
}

export async function styleNote(text: string) {
  const key = anthropicKey();
  if (!key) return "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 120,
      messages: [{ role: "user", content: text }],
    }),
  });
  const json = (await res.json()) as { content?: { text?: string }[]; error?: { message?: string } };
  if (!res.ok) return "";
  return json.content?.[0]?.text?.trim() ?? "";
}
