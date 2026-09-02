# Uvel Light Mode Audit

## Scope

The selected repository is `allentackie-ops/uvel`, an Expo Router native app with five tab screens and additional commerce, onboarding, seller, and brand routes.

## Existing theme architecture

- `lib/theme.ts` already exposes `palettes.light` and `palettes.dark` through `useColors()`.
- The light palette is warm and editorial: ink `#F4F0E6`, surface `#FFFFFF`, bone `#16140F`, muted `#6B6560`, subtle `#8E887E`, lime success `#D6E27A`.
- `lib/store.ts` defaults appearance to `light` and persists the appearance setting.
- `app/_layout.tsx` still hardcodes dark navigation backgrounds and header colors, and the root splash wrapper forces a dark status bar/background.

## Primary blockers found

- `app/(tabs)/_layout.tsx`: tab pager, bar, active/inactive icon colors, and labels are hardcoded dark.
- Main tab screens `app/(tabs)/index.tsx`, `find.tsx`, `shop.tsx`, and `you.tsx`: large style factories are nominally passed `colors` but still use dark-only literals for most surfaces, text, borders, inputs, chips, and buttons.
- `app/settings.tsx`: uses a `SETTINGS_COLORS` object derived from `palettes.dark`, so the appearance control itself cannot reflect light mode.
- `app/sell.tsx`: uses `SELL_COLORS` pinned to a dark palette, despite the rest of the style factory being token-shaped.
- `app/_layout.tsx`: root navigation and modal route content styles include fixed dark backgrounds; draft overlay is fixed dark.
- `components/Sheet.tsx`, `components/ScreenSkeletons.tsx`, and `components/Skeleton.tsx`: shared modal/loading surfaces are dark-only.
- Some route-specific brand files retain dark-only styling and need a final sweep for comprehensive coverage.

## Conversion approach

1. Keep the existing editorial palette and semantic colors intact.
2. Replace dark-only constants in shared/root surfaces with `useColors()`-driven styles.
3. Convert all main tab factories to map surface/text/border/input/button colors from the active palette.
4. Remove `palettes.dark` overrides in settings and selling.
5. Sweep remaining routes for fixed dark literals and patch the remaining user-visible screens without changing functionality.
6. Run TypeScript/Expo checks and inspect the web bundle where available.
