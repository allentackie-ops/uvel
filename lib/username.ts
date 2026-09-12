export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const RESERVED_USERNAMES = new Set(["admin", "support", "uvel", "official", "help", "null", "undefined"]);

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

export function isValidUsername(value: string) {
  const username = normalizeUsername(value);
  return USERNAME_PATTERN.test(username) && !RESERVED_USERNAMES.has(username);
}
