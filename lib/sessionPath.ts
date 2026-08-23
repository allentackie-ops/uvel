export type AuthVia = "signup" | "login";

/** Setup wizard is only for a brand-new Sign up. Log in goes to the app. */
export function shouldAskSetup(via: AuthVia) {
  return via === "signup";
}
