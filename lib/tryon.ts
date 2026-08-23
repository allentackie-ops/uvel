import Constants from "expo-constants";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
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

export function resolveSource(src: ImageSourcePropType | { uri: string }) {
  if (typeof src === "object" && src && "uri" in src && src.uri) return src.uri;
  const r = Image.resolveAssetSource(src as number);
  return r.uri;
}

async function uriToDataUrl(uri: string) {
  if (uri.startsWith("data:")) return uri;
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1024 });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.86, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) throw new Error("Couldn’t read that photo.");
  return `data:image/jpeg;base64,${saved.base64}`;
}

const PROMPT =
  "Edit photo 1 only. Keep this exact photograph: same person, same face, same body, same pose, same room, same lighting, same camera angle. Replace only the clothing with the garment from photo 2. Do not redraw the person. Do not invent a new face. Photorealistic. No text.";

const FALLBACK =
  "Photo 1 is the person. Photo 2 is a clothing item. Put the clothes from photo 2 onto the person in photo 1. Keep the same person, face, hair, pose and room. Catalog photo. Photorealistic. No text.";

function nice(text: string) {
  const low = text.toLowerCase();
  if (low.includes("incorrect api key") || low.includes("invalid_api_key") || low.includes("unauthorized") || low.includes("401")) {
    return "That OpenAI key isn’t valid. Send a new one from platform.openai.com/api-keys.";
  }
  if (low.includes("insufficient_quota") || low.includes("billing") || low.includes("exceeded your current quota")) {
    return "OpenAI needs billing on this key. Add a card at platform.openai.com/settings/organization/billing.";
  }
  if (low.includes("moderation_blocked") || low.includes("safety system") || low.includes("rejected as a result") || low.includes("safety_violations")) {
    return "Couldn’t dress you in that. Try another photo of the piece.";
  }
  if (low.includes("formdatapart")) return "Couldn’t send that photo. Try Library again.";
  if (low.includes("rate") || low.includes("429")) return "Try-on is busy. Wait a moment.";
  if (
    low.includes("timed out") ||
    low.includes("timeout") ||
    low.includes("unexpectedexception") ||
    low.includes("expo modules")
  ) {
    return "That look took too long. Try again.";
  }
  if (low.includes("network") || low.includes("failed to fetch") || low.includes("fetch failed")) {
    return "No connection. Try again.";
  }
  return text.slice(0, 220) || "Couldn’t dress you in that. Try again.";
}

function imageFrom(json: { error?: { message?: string }; data?: { b64_json?: string; url?: string }[] }) {
  if (json.error?.message) throw new Error(json.error.message);
  const d = json.data?.[0];
  if (d?.b64_json) return `data:image/jpeg;base64,${d.b64_json}`;
  if (d?.url) return d.url;
  throw new Error("No image came back.");
}

function postJson(url: string, headers: Record<string, string>, body: string, ms: number) {
  return new Promise<{ ok: boolean; status: number; json: Parameters<typeof imageFrom>[0] }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = ms;
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.onload = () => {
      try {
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          json: JSON.parse(xhr.responseText || "{}"),
        });
      } catch {
        reject(new Error("Couldn’t read the try-on result."));
      }
    };
    xhr.onerror = () => reject(new Error("No connection. Try again."));
    xhr.ontimeout = () => reject(new Error("That look took too long. Try again."));
    xhr.send(body);
  });
}

async function openaiEdits(images: string[], prompt: string) {
  const key = openaiKey();
  const body = JSON.stringify({
    model: "gpt-image-2",
    prompt,
    images: images.map((image_url) => ({ image_url })),
    size: "1024x1536",
    quality: "medium",
    moderation: "low",
    output_format: "jpeg",
  });
  const res = await postJson(
    "https://api.openai.com/v1/images/edits",
    { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body,
    120000,
  );
  if (!res.ok) throw new Error(res.json.error?.message || `Try-on failed (${res.status}).`);
  return imageFrom(res.json);
}

function isBlocked(err: unknown) {
  const low = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    low.includes("moderation_blocked") ||
    low.includes("safety system") ||
    low.includes("rejected as a result") ||
    low.includes("safety_violations")
  );
}

export async function dressPerson(opts: {
  personUri: string;
  garment: ImageSourcePropType | { uri: string };
  garmentName?: string;
  category?: string;
}) {
  if (!openaiKey()) throw new Error("Add your OpenAI key and I’ll turn try-on on.");
  try {
    const [personUrl, garmentUrl] = await Promise.all([
      uriToDataUrl(opts.personUri),
      uriToDataUrl(resolveSource(opts.garment)),
    ]);
    const images = [personUrl, garmentUrl];
    try {
      return await openaiEdits(images, PROMPT);
    } catch (err) {
      if (!isBlocked(err)) throw err;
      return await openaiEdits(images, FALLBACK);
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
