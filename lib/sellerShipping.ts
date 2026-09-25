import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { MARKETS, getMarket } from "./markets";

export type SellerShippingMethod = "dropoff" | "pickup";

export type ShippingCarrier = {
  id: string;
  name: string;
  description: string;
  method: SellerShippingMethod;
  speed: "standard" | "express";
};

// Brand marks identify the delivery provider; they are not used as Uvel branding.
const CARRIER_LOGOS: Record<string, string> = {
  usps: "https://cdn.simpleicons.org/usps",
  ups: "https://cdn.simpleicons.org/ups",
  fedex: "https://cdn.simpleicons.org/fedex",
  "canada-post": "https://www.google.com/s2/favicons?domain=canadapost-postescanada.ca&sz=128",
  purolator: "https://www.google.com/s2/favicons?domain=purolator.com&sz=128",
  "royal-mail": "https://www.google.com/s2/favicons?domain=royalmail.com&sz=128",
  evri: "https://www.google.com/s2/favicons?domain=evri.com&sz=128",
  dpd: "https://cdn.simpleicons.org/dpd",
  "an-post": "https://www.google.com/s2/favicons?domain=anpost.com&sz=128",
  dhl: "https://cdn.simpleicons.org/dhl",
  "ghana-post": "https://www.google.com/s2/favicons?domain=ghanapost.com.gh&sz=128",
  nipost: "https://www.google.com/s2/favicons?domain=nipost.gov.ng&sz=128",
  "posta-kenya": "https://www.google.com/s2/favicons?domain=posta.co.ke&sz=128",
  fargo: "https://www.google.com/s2/favicons?domain=fargocourier.com&sz=128",
  sapo: "https://www.google.com/s2/favicons?domain=postoffice.co.za&sz=128",
  aramex: "https://www.google.com/s2/favicons?domain=aramex.com&sz=128",
};

export type SellerAddress = {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};

export type SellerShippingSettings = {
  address?: SellerAddress;
  method: SellerShippingMethod;
  buyerPays: boolean;
  carriersByCountry: Record<string, string[]>;
  updatedAt: number;
};

const KEY = "uvel-seller-shipping-v1";
let current: SellerShippingSettings | null = null;
let loaded = false;
let loading: Promise<SellerShippingSettings> | null = null;
const listeners = new Set<(settings: SellerShippingSettings) => void>();

const COUNTRY_CARRIERS: Record<string, ShippingCarrier[]> = {
  US: [
    { id: "usps", name: "USPS", description: "Drop off at a USPS location.", method: "dropoff", speed: "standard" },
    { id: "ups", name: "UPS", description: "Drop off at a UPS location.", method: "dropoff", speed: "standard" },
    { id: "fedex", name: "FedEx", description: "Drop off at a FedEx location.", method: "dropoff", speed: "express" },
  ],
  CA: [
    { id: "canada-post", name: "Canada Post", description: "Drop off at a Canada Post location.", method: "dropoff", speed: "standard" },
    { id: "purolator", name: "Purolator", description: "Drop off at a Purolator location.", method: "dropoff", speed: "standard" },
    { id: "fedex", name: "FedEx", description: "Drop off at a FedEx location.", method: "dropoff", speed: "express" },
  ],
  GB: [
    { id: "royal-mail", name: "Royal Mail", description: "Drop off at a Post Office or Royal Mail point.", method: "dropoff", speed: "standard" },
    { id: "evri", name: "Evri", description: "Drop off at an Evri ParcelShop or locker.", method: "dropoff", speed: "standard" },
    { id: "dpd", name: "DPD", description: "Drop off at a DPD pickup point.", method: "dropoff", speed: "express" },
  ],
  IE: [
    { id: "an-post", name: "An Post", description: "Drop off at an An Post location.", method: "dropoff", speed: "standard" },
    { id: "dpd", name: "DPD", description: "Drop off at a DPD pickup point.", method: "dropoff", speed: "express" },
    { id: "dhl", name: "DHL", description: "Drop off at a DHL service point.", method: "dropoff", speed: "express" },
  ],
  GH: [
    { id: "ghana-post", name: "Ghana Post", description: "Drop off at a Ghana Post location.", method: "dropoff", speed: "standard" },
    { id: "dhl", name: "DHL", description: "Drop off at a DHL service point.", method: "dropoff", speed: "express" },
    { id: "fedex", name: "FedEx", description: "Drop off at a FedEx location.", method: "dropoff", speed: "express" },
  ],
  NG: [
    { id: "nipost", name: "NIPOST", description: "Drop off at a NIPOST location.", method: "dropoff", speed: "standard" },
    { id: "dhl", name: "DHL", description: "Drop off at a DHL service point.", method: "dropoff", speed: "express" },
    { id: "fedex", name: "FedEx", description: "Drop off at a FedEx location.", method: "dropoff", speed: "express" },
  ],
  KE: [
    { id: "posta-kenya", name: "Posta Kenya", description: "Drop off at a Posta Kenya location.", method: "dropoff", speed: "standard" },
    { id: "dhl", name: "DHL", description: "Drop off at a DHL service point.", method: "dropoff", speed: "express" },
    { id: "fargo", name: "Fargo Courier", description: "Drop off at a Fargo location.", method: "dropoff", speed: "standard" },
  ],
  ZA: [
    { id: "sapo", name: "South African Post Office", description: "Drop off at a Post Office location.", method: "dropoff", speed: "standard" },
    { id: "aramex", name: "Aramex", description: "Drop off at an Aramex location.", method: "dropoff", speed: "standard" },
    { id: "dhl", name: "DHL", description: "Drop off at a DHL service point.", method: "dropoff", speed: "express" },
  ],
};

function fallbackCarriers(country: string): ShippingCarrier[] {
  const market = getMarket(country);
  return [
    { id: `${market.code.toLowerCase()}-post`, name: `${market.name} postal service`, description: `Drop off at a supported ${market.name} postal location.`, method: "dropoff", speed: "standard" },
    { id: `${market.code.toLowerCase()}-dhl`, name: "DHL", description: "Drop off at a DHL service point.", method: "dropoff", speed: "express" },
    { id: `${market.code.toLowerCase()}-fedex`, name: "FedEx", description: "Drop off at a FedEx location.", method: "dropoff", speed: "express" },
  ];
}

export function carriersForCountry(country?: string | null): ShippingCarrier[] {
  const code = getMarket(country).code;
  return COUNTRY_CARRIERS[code] || fallbackCarriers(code);
}

export function carrierLogoUrl(id: string) {
  return CARRIER_LOGOS[id];
}

export function carriersForListing(country: string | undefined, ids?: string[], method: SellerShippingMethod = "dropoff") {
  const available = carriersForCountry(country).filter((carrier) => method === "pickup" || carrier.method === method);
  if (!ids?.length) return available;
  const enabled = new Set(ids);
  return available.filter((carrier) => enabled.has(carrier.id));
}

export function defaultSellerShipping(country?: string | null): SellerShippingSettings {
  const code = getMarket(country).code;
  return {
    method: "dropoff",
    buyerPays: true,
    carriersByCountry: { [code]: carriersForCountry(code).map((carrier) => carrier.id) },
    updatedAt: 0,
  };
}

function normalize(value?: Partial<SellerShippingSettings> | null): SellerShippingSettings {
  const base = defaultSellerShipping();
  const carriersByCountry = { ...base.carriersByCountry, ...(value?.carriersByCountry || {}) };
  return {
    address: value?.address,
    method: value?.method === "pickup" ? "pickup" : "dropoff",
    buyerPays: value?.buyerPays !== false,
    carriersByCountry,
    updatedAt: typeof value?.updatedAt === "number" ? value.updatedAt : 0,
  };
}

async function hydrate() {
  if (loaded && current) return current;
  if (loading) return loading;
  loading = AsyncStorage.getItem(KEY).then((raw) => {
    current = normalize(raw ? (JSON.parse(raw) as Partial<SellerShippingSettings>) : undefined);
    loaded = true;
    listeners.forEach((listener) => listener(current as SellerShippingSettings));
    return current as SellerShippingSettings;
  }).catch(() => {
    current = normalize();
    loaded = true;
    return current;
  });
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export async function loadSellerShippingSettings() {
  return hydrate();
}

export async function saveSellerShippingSettings(patch: Partial<SellerShippingSettings>) {
  const next = normalize({ ...(current || normalize()), ...patch, updatedAt: Date.now() });
  current = next;
  loaded = true;
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener(next));
  return next;
}

export function useSellerShippingSettings() {
  const [settings, setSettings] = useState<SellerShippingSettings>(current || normalize());
  useEffect(() => {
    const listener = (next: SellerShippingSettings) => setSettings(next);
    listeners.add(listener);
    void hydrate().then(setSettings);
    return () => { listeners.delete(listener); };
  }, []);
  return settings;
}

export function shippingMethodLabel(method: SellerShippingMethod) {
  return method === "pickup" ? "Courier collects from my address" : "I drop it off";
}

export function enabledCarriersForCountry(settings: SellerShippingSettings, country?: string | null) {
  const code = getMarket(country).code;
  const ids = settings.carriersByCountry[code] || carriersForCountry(code).map((carrier) => carrier.id);
  return carriersForListing(code, ids, settings.method);
}

export function allMarketCodes() {
  return MARKETS.map((market) => market.code);
}
