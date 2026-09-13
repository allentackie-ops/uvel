/**
 * Established houses — brands that already exist in the real world and come
 * onto Uvel later (website, not this app).
 *
 * They get a blue check the moment they are approved. No sales required.
 * Founder Studio never calls this. Keep it in the repo until the website
 * apply path is live. The in-app legal apply screen is parked at
 * app/brand/_legalApply.tsx and is not routed.
 */
import { submitForVerification, type Brand } from "./brands";
import type { BrandFiling } from "./brandVerify";

export async function approveHouseBrand(id: string, filing: BrandFiling) {
  return submitForVerification(id, filing);
}

export function houseCheckOnApproval(): Pick<Brand, "origin" | "check" | "verified" | "status"> {
  return { origin: "house", check: "blue", verified: true, status: "verified" };
}
