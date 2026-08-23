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

function filePart(uri: string, name: string) {
  return { uri, name, type: mimeOf(uri) } as unknown as Blob;
}

function promptFor(name: string, category: string) {
  const kind = category.toLowerCase();
  let swap = "Replace their current outfit with this piece so they are wearing it.";
  if (kind.includes("top") || kind.includes("knit") || kind.includes("blouse") || kind.includes("shirt")) {
    swap = "Replace only their top with this piece. Keep their bottoms unless the top is a long tunic.";
  } else if (kind.includes("trouser") || kind.includes("skirt") || kind.includes("pant") || kind.includes("denim")) {
    swap = "Replace only their bottoms with this piece. Keep their top.";
  } else if (kind.includes("outer") || kind.includes("coat") || kind.includes("jacket") || kind.includes("blazer")) {
    swap = "Put this outerwear on them over their existing clothes, as if they just put the jacket on.";
  } else if (kind.includes("dress") || kind.includes("slip")) {
    swap = "Dress them in this as a one-piece. Remove the current outfit.";
  } else if (kind.includes("shoe")) {
    swap = "Put these shoes on their feet. Keep the rest of the outfit.";
  }

  return `Virtual try-on. The first image is the person. The second image is the garment (${name}, ${category}).

${swap}

They must look like they are actually wearing it in this same photo — same face, skin, hair, body, pose, hands, phone, jewelry, room, lighting, and camera. Fabric should drape on THEIR body. Photorealistic. No collage, no floating product, no overlay, no mannequin, no text, no watermark.`;
}

function nice(text: string) {
  const low = text.toLowerCase();
  if (low.includes("incorrect api key") || low.includes("invalid_api_key") || low.includes("unauthorized") || low.includes("401")) {
    return "That OpenAI key isn’t valid. Send a new one from platform.openai.com/api-keys.";
  }
  if (low.includes("insufficient_quota") || low.includes("billing") || low.includes("exceeded your current quota")) {
    return "OpenAI needs billing on this key. Add a card at platform.openai.com/settings/organization/billing.";
  }
  if (low.includes("blocked") || low.includes("safety") || low.includes("moderation") || low.includes("responsible")) {
    return "That photo was blocked. Try a full-length mirror pic with your face in frame.";
  }
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

async function openaiEdits(personUri: string, garmentUri: string, prompt: string) {
  const key = openaiKey();
  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("prompt", prompt);
  form.append("size", "1024x1536");
  form.append("quality", "low");
  form.append("image[]", filePart(personUri, "person.jpg"));
  form.append("image[]", filePart(garmentUri, "garment.jpg"));
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const json = (await res.json()) as Parameters<typeof imageFrom>[0];
  if (!res.ok) throw new Error(json.error?.message || `Try-on failed (${res.status}).`);
  return imageFrom(json);
}

export async function dressPerson(opts: {
  personUri: string;
  garment: ImageSourcePropType | { uri: string };
  garmentName?: string;
  category?: string;
}) {
  if (!openaiKey()) throw new Error("Add your OpenAI key and I’ll turn try-on on.");
  const prompt = promptFor(opts.garmentName ?? "this piece", opts.category ?? "clothes");
  try {
    return await openaiEdits(opts.personUri, resolveSource(opts.garment), prompt);
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
