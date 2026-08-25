export type BrandContactInput = {
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  contactEmail?: string;
  website?: string;
};

function value(input: BrandContactInput, key: keyof BrandContactInput) {
  return String(input[key] || "").trim();
}

export function validContactEmail(email?: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value({ contactEmail: email }, "contactEmail"));
}

export function validContactNumber(number?: string) {
  return value({ phone: number }, "phone").replace(/[^0-9]/g, "").length >= 7;
}

export function validInstagram(handle?: string) {
  return /^@?[a-z0-9._]{2,30}$/i.test(value({ instagram: handle }, "instagram"));
}

export function validWebsite(url?: string) {
  return /^https?:\/\/[^\s]+$/i.test(value({ website: url }, "website"));
}

export function hasBrandContact(input: BrandContactInput) {
  return (
    validContactNumber(input.phone) ||
    validContactNumber(input.whatsapp) ||
    validInstagram(input.instagram) ||
    validContactEmail(input.contactEmail) ||
    validWebsite(input.website)
  );
}

export function brandContactHint(input: BrandContactInput) {
  const channels = [
    validContactNumber(input.phone) ? "phone" : "",
    validContactNumber(input.whatsapp) ? "WhatsApp" : "",
    validInstagram(input.instagram) ? "Instagram" : "",
    validContactEmail(input.contactEmail) ? "email" : "",
    validWebsite(input.website) ? "website" : "",
  ].filter(Boolean);
  return channels.length ? channels.join(", ") : "none yet";
}
