import Constants from "expo-constants";
import { Image, type ImageSourcePropType } from "react-native";
import { firebaseExtra, firebaseReady } from "./firebase";

const MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];

type Extra = { geminiApiKey?: string };

function geminiKey() {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  return extra.geminiApiKey || firebaseExtra.apiKey || "";
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

async function uriToInline(uri: string) {
  const res = await fetch(uri);
  if (!res.ok) throw new Error("Couldn’t read that photo.");
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (!bytes.length) throw new Error("That photo is empty.");
  return { mimeType: mimeOf(uri), data: bytesToBase64(bytes) };
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

  return `Virtual try-on. Image 1 is the person. Image 2 is the garment (${name}, ${category}).

${swap}

They must look like they are actually wearing it in this same photo — same face, skin, hair, body, pose, hands, phone, jewelry, room, lighting, and camera. Fabric should drape on THEIR body. Photorealistic. No collage, no floating product, no overlay, no mannequin, no text, no watermark.

Output only the finished photograph.`;
}

function nice(text: string) {
  const low = text.toLowerCase();
  if (low.includes("app check")) {
    return "Gemini is locked. In Firebase: App Check → APIs → Firebase AI Logic → Monitor, not Enforce.";
  }
  if (
    low.includes("has not been used") ||
    low.includes("service_disabled") ||
    low.includes("api-not-enabled") ||
    low.includes("enable it by visiting")
  ) {
    return "Turn on Gemini: Firebase → AI Logic → Get started.";
  }
  if (low.includes("are blocked") || low.includes("api_key_ios_app_blocked") || low.includes("requests to this api")) {
    return "The Firebase key can’t call Gemini. Make a Gemini API key in Google AI Studio (aistudio.google.com/apikey) and send it.";
  }
  if (low.includes("blocked") || low.includes("safety") || low.includes("image-rejected") || low.includes("prohibited")) {
    return "That photo was blocked. Try a full-length mirror pic with your face in frame.";
  }
  if (low.includes("quota") || low.includes("resource-exhausted") || low.includes("billing")) {
    return "Gemini needs billing on this Firebase project (Spark can’t generate images). Upgrade to Blaze, then retry.";
  }
  if (low.includes("network") || low.includes("failed to fetch")) return "No connection. Try again.";
  return text.replace(/^AI:\s*/, "").slice(0, 220) || "Couldn’t dress you in that. Try again.";
}

type Part = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};

function imageFrom(json: {
  error?: { message?: string };
  candidates?: { content?: { parts?: Part[] } }[];
}) {
  if (json.error?.message) throw new Error(json.error.message);
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const blob = p.inlineData || p.inline_data;
    const data = blob?.data;
    if (data) {
      const mime = ("mimeType" in (blob ?? {}) ? p.inlineData?.mimeType : p.inline_data?.mime_type) || "image/png";
      return `data:${mime};base64,${data}`;
    }
  }
  throw new Error("No image came back.");
}

async function once(model: string, person: { mimeType: string; data: string }, garment: { mimeType: string; data: string }, prompt: string) {
  const key = geminiKey();
  if (!key) throw new Error("Gemini isn’t connected yet.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: person.mimeType, data: person.data } },
            { inline_data: { mime_type: garment.mimeType, data: garment.data } },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "3:4", imageSize: "1K" },
      },
      safetySettings: [
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
      ],
    }),
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
  if (!firebaseReady() && !geminiKey()) throw new Error("Firebase isn’t connected yet.");
  const [person, garment] = await Promise.all([
    uriToInline(opts.personUri),
    uriToInline(resolveSource(opts.garment)),
  ]);
  const prompt = promptFor(opts.garmentName ?? "this piece", opts.category ?? "clothes");
  let last = "Couldn’t dress you in that.";
  for (const name of MODELS) {
    try {
      return await once(name, person, garment, prompt);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      last = nice(raw);
      if (!/404|not found|not supported|unknown model|is not found/i.test(raw)) throw new Error(last);
    }
  }
  throw new Error(last);
}
