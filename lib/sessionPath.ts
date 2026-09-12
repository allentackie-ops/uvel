export type AuthVia = "signup" | "login";

export function shouldAskSetup(via: AuthVia) {
  return via === "signup";
}

export function remoteProfileComplete(remote: Record<string, unknown> | null | undefined) {
  return Boolean(remote && remote.profileDone === true);
}

/**
 * Main app only after they finish setup (username and all).
 * Login, reinstall, or a stale session does not skip an unfinished profile.
 */
export function skipSetup(opts: {
  via?: AuthVia | null;
  remote?: Record<string, unknown> | null;
  stashedDone?: boolean;
  createdAt?: string | null;
  lastSignInAt?: string | null;
}) {
  if (opts.stashedDone) return true;
  if (remoteProfileComplete(opts.remote)) return true;
  return false;
}
