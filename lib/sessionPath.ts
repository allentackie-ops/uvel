export type AuthVia = "signup" | "login";

/** Setup wizard is only for a brand-new Sign up. Log in goes to the app. */
export function shouldAskSetup(via: AuthVia) {
  return via === "signup";
}

export function remoteProfileComplete(remote: Record<string, unknown> | null | undefined) {
  if (!remote) return false;
  if (remote.profileDone === true) return true;
  if (typeof remote.birthday === "string" && remote.birthday.trim()) return true;
  if (typeof remote.gender === "string" && remote.gender.trim()) return true;
  if (Array.isArray(remote.styles) && remote.styles.length > 0) return true;
  return false;
}

export function accountIsEstablished(opts: { createdAt?: string | null; lastSignInAt?: string | null }) {
  const created = Date.parse(opts.createdAt ?? "");
  const last = Date.parse(opts.lastSignInAt ?? "");
  if (Number.isFinite(created) && Number.isFinite(last) && last - created > 15_000) return true;
  if (Number.isFinite(created) && Date.now() - created > 60_000) return true;
  return false;
}

/**
 * Hard rule: an account that already exists never runs setup again.
 * Login, reinstall, logout, or a backend profile all skip the wizard.
 * Only a brand-new signup with no backend profile is asked to set up.
 */
export function skipSetup(opts: {
  via?: AuthVia | null;
  remote?: Record<string, unknown> | null;
  stashedDone?: boolean;
  createdAt?: string | null;
  lastSignInAt?: string | null;
}) {
  if (opts.via === "login") return true;
  if (opts.stashedDone) return true;
  if (remoteProfileComplete(opts.remote)) return true;
  if (accountIsEstablished(opts)) return true;
  return false;
}
