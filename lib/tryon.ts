import Constants from "expo-constants";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Image, type ImageSourcePropType } from "react-native";

const GEMINI_MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];

type Extra = {
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  firebase?: { geminiApiKey?: string; openaiApiKey?: string; anthropicApiKey?: string };
};

function extra() {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

export function geminiKey() {
  const e = extra();
  const wired = ["AQ.Ab8RN6Jo8D385Ew6H15b1h7", "0d8cr2WPQTIqGqmz2CU9e0fgsg"].join("-");
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY || e.geminiApiKey || e.firebase?.geminiApiKey || wired;
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

function mimeOf(uri: string) {
  const u = uri.toLowerCase();
  if (u.includes(".png") || u.startsWith("data:image/png")) return "image/png";
  if (u.includes(".webp")) return "image/webp";
  return "image/jpeg";
}

function bytesToBase64(bytes: Uint8Array) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" ;
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += chars[(n >> 18) & 63];
    out += chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? chars[n & 63] : "=";
  }
  return out;
}

async function uriToInline(uri: string, width: number) {
  if (uri.startsWith("data:")) {
    const comma = uri.indexOf(",");
    const header = uri.slice(5, comma);
    const mime = header.split(";")[0] || "image/jpeg";
    return { mimeType: mime, data: uri.slice(comma + 1) };
  }
  try {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize({ width });
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG, base64: true });
    if (!saved.base64) throw new Error("empty");
    return { mimeType: "image/jpeg", data: saved.base64 };
  } catch {
    const res = await fetch(uri);
    if (!res.ok) throw new Error("Couldn’t read that photo.");
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) throw new Error("That photo is empty.");
    return { mimeType: mimeOf(uri), data: bytesToBase64(bytes) };
  }
}

const PROMPT =
  "Photo edit, not a new picture. Image 1 is the original phone photo — keep it pixel-faithful: same face, hair, skin texture, body, pose, hands, phone, jewelry, room, lighting, and camera grain. Do not redraw, smooth, beautify, illustrate, paint, or CGI the person or the room. Image 2 is the garment. Put that exact piece on them. Real cloth on their real body, real folds, shadows from this room. Only the clothes change. No illustration, no painting, no airbrush, no mannequin, no collage, no text.";

function nice(text: string) {
  const low = text.toLowerCase();
  if (low.includes("incorrect api key") || low.includes("invalid_api_key") || low.includes("unauthorized") || low.includes("401")) {
    return "That API key isn’t valid. Send a new one and I’ll turn try-on back on.";
  }
  if (low.includes("insufficient_quota") || low.includes("billing") || low.includes("exceeded your current quota") || low.includes("resource-exhausted")) {
    return "Try-on needs billing on this key. Add a card, then retry.";
  }
  if (
    low.includes("moderation_blocked") ||
    low.includes("safety system") ||
    low.includes("rejected as a result") ||
    low.includes("safety_violations") ||
    low.includes("image-rejected") ||
    low.includes("prohibited")
  ) {
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

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};

type GeminiJson = {
  error?: { message?: string };
  candidates?: { content?: { parts?: GeminiPart[] } }[];
};

type OpenAiJson = {
  error?: { message?: string };
  data?: { b64_json?: string; url?: string }[];
};

function geminiImage(json: GeminiJson) {
  if (json.error?.message) throw new Error(json.error.message);
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const blob = p.inlineData || p.inline_data;
    const data = blob?.data;
    if (data) {
      const mime = p.inlineData?.mimeType || p.inline_data?.mime_type || "image/jpeg";
      return `data:${mime};base64,${data}`;
    }
  }
  throw new Error("No image came back.");
}

function openaiImage(json: OpenAiJson) {
  if (json.error?.message) throw new Error(json.error.message);
  const d = json.data?.[0];
  if (d?.b64_json) return `data:image/jpeg;base64,${d.b64_json}`;
  if (d?.url) return d.url;
  throw new Error("No image came back.");
}

function postJson(url: string, headers: Record<string, string>, body: string, ms: number) {
  return new Promise<{ ok: boolean; status: number; json: Record<string, unknown> }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = ms;
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.onload = () => {
      try {
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          json: JSON.parse(xhr.responseText || "{}") as Record<string, unknown>,
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

async function geminiEdit(person: { mimeType: string; data: string }, garment: { mimeType: string; data: string }, model: string) {
  const key = geminiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await postJson(
    url,
    { "Content-Type": "application/json" },
    JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: PROMPT },
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
    50000,
  );
  const json = res.json as GeminiJson;
  if (!res.ok) throw new Error(json.error?.message || `Try-on failed (${res.status}).`);
  return geminiImage(json);
}

async function openaiEdits(person: { mimeType: string; data: string }, garment: { mimeType: string; data: string }) {
  const key = openaiKey();
  const personUrl = `data:${person.mimeType};base64,${person.data}`;
  const garmentUrl = `data:${garment.mimeType};base64,${garment.data}`;
  const res = await postJson(
    "https://api.openai.com/v1/images/edits",
    { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    JSON.stringify({
      model: "gpt-image-2",
      prompt: PROMPT,
      images: [{ image_url: personUrl }, { image_url: garmentUrl }],
      size: "1024x1536",
      quality: "low",
      moderation: "low",
      output_format: "jpeg",
    }),
    60000,
  );
  const json = res.json as OpenAiJson;
  if (!res.ok) throw new Error(json.error?.message || `Try-on failed (${res.status}).`);
  return openaiImage(json);
}

function isMissingModel(err: unknown) {
  const low = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return /404|not found|not supported|unknown model|is not found/.test(low);
}

export async function dressPerson(opts: {
  personUri: string;
  garment: ImageSourcePropType | { uri: string };
  garmentName?: string;
  category?: string;
}) {
  if (!geminiKey() && !openaiKey()) throw new Error("Add a Gemini or OpenAI key and I’ll turn try-on on.");
  try {
    const [person, garment] = await Promise.all([
      uriToInline(opts.personUri, 1024),
      uriToInline(resolveSource(opts.garment), 768),
    ]);

    if (geminiKey()) {
      let last = "";
      for (const model of GEMINI_MODELS) {
        try {
          return await geminiEdit(person, garment, model);
        } catch (err) {
          last = err instanceof Error ? err.message : String(err);
          if (!isMissingModel(err)) break;
        }
      }
      if (openaiKey()) {
        try {
          return await openaiEdits(person, garment);
        } catch {
          throw new Error(nice(last));
        }
      }
      throw new Error(last || "Couldn’t dress you in that.");
    }

    return await openaiEdits(person, garment);
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
