import {
  getGenerativeModel,
  HarmBlockThreshold,
  HarmCategory,
  ResponseModality,
} from "firebase/ai";
import { Image, type ImageSourcePropType } from "react-native";
import { firebaseAi, firebaseReady } from "./firebase";

const MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];

const SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

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

async function uriToPart(uri: string) {
  const res = await fetch(uri);
  if (!res.ok) throw new Error("Couldn’t read that photo.");
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (!bytes.length) throw new Error("That photo is empty.");
  return {
    inlineData: {
      mimeType: mimeOf(uri),
      data: bytesToBase64(bytes),
    },
  };
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

function nice(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  const low = text.toLowerCase();
  if (low.includes("ai logic") || low.includes("not found") || low.includes("404") || low.includes("permission") || low.includes("api has not been used") || low.includes("enable")) {
    return "Turn on Gemini in Firebase (AI Logic → Get started), then try again.";
  }
  if (low.includes("blocked") || low.includes("safety") || low.includes("image-rejected")) {
    return "That photo was blocked. Try a full-length mirror pic with your face in frame.";
  }
  if (low.includes("quota") || low.includes("resource-exhausted") || low.includes("429")) {
    return "Try-on is busy. Wait a moment.";
  }
  if (low.includes("network") || low.includes("failed to fetch")) return "No connection. Try again.";
  return text || "Couldn’t dress you in that. Try again.";
}

async function once(modelName: string, person: Awaited<ReturnType<typeof uriToPart>>, garment: Awaited<ReturnType<typeof uriToPart>>, prompt: string) {
  const model = getGenerativeModel(
    firebaseAi(),
    {
      model: modelName,
      generationConfig: {
        responseModalities: [ResponseModality.IMAGE],
        imageConfig: { aspectRatio: "3:4", imageSize: "1K" },
      },
      safetySettings: SAFETY,
    },
    { timeout: 55000 },
  );
  const result = await model.generateContent([prompt, person, garment]);
  const parts = result.response.inlineDataParts();
  const data = parts?.[0]?.inlineData;
  if (!data?.data) throw new Error("No image came back.");
  const mime = data.mimeType || "image/png";
  return `data:${mime};base64,${data.data}`;
}

export async function dressPerson(opts: {
  personUri: string;
  garment: ImageSourcePropType | { uri: string };
  garmentName?: string;
  category?: string;
}) {
  if (!firebaseReady()) throw new Error("Firebase isn’t connected yet.");
  const [person, garment] = await Promise.all([
    uriToPart(opts.personUri),
    uriToPart(resolveSource(opts.garment)),
  ]);
  const prompt = promptFor(opts.garmentName ?? "this piece", opts.category ?? "clothes");
  let last = "Couldn’t dress you in that.";
  for (const name of MODELS) {
    try {
      return await once(name, person, garment, prompt);
    } catch (err) {
      last = nice(err);
      const raw = err instanceof Error ? err.message : String(err);
      if (!/404|not found|not supported|unknown model/i.test(raw)) throw new Error(last);
    }
  }
  throw new Error(last);
}
