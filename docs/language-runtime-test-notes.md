# Language runtime test notes

The running Expo web build was set to a local-only test session. Selecting `Français` in the onboarding picker changed the visible onboarding copy immediately, including the headline, auth buttons, CTA, consent sentence, and legal-link labels. Reloading preserved French.

The Settings route was then opened using the local test state. It rendered translated French copy including `Réglages`, `Assistance`, `Préférences`, `Apparence`, `Notifications`, `Langue`, and `Supprimer le compte`. Opening the language row and selecting `English, US` immediately re-rendered the same Settings screen back to English, proving bidirectional runtime switching.

A pre-existing web-only `expo-file-system` `getInfoAsync` error from `lib/lookFrame.ts` appears during video prefetch and is unrelated to locale state. The focused i18n regression test passed, and web/Android exports passed.
