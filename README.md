# Uvel — dress & shop

Native **iOS + Android** app on **Expo SDK 57**.

Liquid Glass is Apple’s, not CSS: `expo-glass-effect` (`UIVisualEffectView` / iOS 26) and Expo Router **native tabs**.

You do **not** need Xcode on your Mac. Expo’s cloud (EAS) compiles with Xcode 26.

Repo: https://github.com/allentackie-ops/uvel

## Ship to the App Store (no local Xcode)

1. Create / log into [expo.dev](https://expo.dev) with the same Apple Developer account you already have.
2. **Import this GitHub repo** (Project → Create → GitHub → `allentackie-ops/uvel`).
3. Under **Credentials**, connect your Apple team. Expo stores the certs; you never open Xcode.
4. Create the app in [App Store Connect](https://appstoreconnect.apple.com) if it doesn’t exist yet:
   - Bundle ID: `com.uvel.dressandshop`
   - Name: Uvel
   - Subscriptions: `uvel.plus.monthly` ($7.99) and `uvel.plus.yearly` ($68.99)
5. Run a production build:

```bash
npx eas-cli login
npx eas-cli init          # paste the project ID into app.json extra.eas.projectId
npx eas-cli build --platform ios --profile production --auto-submit
```

`--auto-submit` sends the .ipa to App Store Connect when the cloud build finishes.

Android / Play Store (same project):

```bash
npx eas-cli build --platform android --profile production --auto-submit
```

## What’s in the binary

| Tab | Native behavior |
| --- | --- |
| Today | iOS 26 liquid-glass tab bar over editorial looks |
| Find | Camera + Photos (`expo-image-picker`), paste IG / TikTok / Pinterest / Snap links |
| Try on | Your photo + a piece, on-device overlay |
| Shop | Archive floor, plus **Start a brand** |
| You | Style DNA, Uvel+, brand owner desk |
| You | Style DNA, Uvel+ |

Glass surfaces use `GlassView` / `GlassContainer` from `expo-glass-effect` (iOS 26+). Older iOS and Android get a translucent fallback.

## Brands

Brands are not personal closets. **Start a brand** lives on Shop.

1. File the house (name, legal, story, mark).
2. Anthropic scans the filing. Impersonation, empty shells, and anything that isn’t fashion fail.
3. The person who filed becomes **Owner** (You tab). Verified houses get the blue Meta-style check.
4. Owner invites posters. Posters list on the brand page; they don’t own it.
5. The brand page is its own room: logo, image or video banner, sixteen colourways plus custom hex.
6. Listings take the whole rack — clothes, shoes, jewelry, hats, swim — with available sizes.
7. Analysis (earnings, views, likes, conversion) stays on the owner desk unless they share it with the team.


## Local preview (optional)

```bash
npx expo start
```

Scan the QR code with **Expo Go** on iPhone. Liquid Glass only shows on **iOS 26** (or a device/simulator with that OS). A store build from EAS is what ships.
