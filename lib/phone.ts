import { AsYouType, type CountryCode } from "libphonenumber-js";

export function formatPhoneInput(value: string, countryCode: string): string {
  if (!value) return "";

  try {
    return new AsYouType(countryCode.toUpperCase() as CountryCode).input(value);
  } catch {
    return value;
  }
}
