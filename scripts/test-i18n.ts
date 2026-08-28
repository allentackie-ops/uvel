import { COPY, t } from "../lib/i18n";

const english = t("en-US");
const french = t("fr");

const requiredKeys = [
  "settings",
  "support",
  "language",
  "today",
  "movingNow",
  "shopTheLook",
  "newListing",
  "photos",
  "price",
  "category",
  "sold",
  "likes",
] as const;

for (const key of requiredKeys) {
  if (!english[key] || !french[key]) throw new Error(`Missing translation key: ${key}`);
}

if (french.settings === english.settings) throw new Error("French Settings copy did not translate");
if (french.newListing === english.newListing) throw new Error("French Sell copy did not translate");
if (french.movingNow === english.movingNow) throw new Error("French Today copy did not translate");
if (t("unsupported-locale").settings !== english.settings) throw new Error("Unsupported locale did not fall back to English");
if (!COPY.fr || !COPY["en-US"]) throw new Error("Expected language catalogs are missing");

console.log("i18n regression test passed: French core copy and English fallback are present.");
