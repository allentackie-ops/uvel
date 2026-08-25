# Token-based OTA publishing

Uvel ships JS updates over Expo EAS Update. The binary stays on the App Store; this publishes a new JS bundle to the **production** channel. Phones already on that binary pull it on next launch (`lib/ota.ts`).

You do **not** need a local Expo login. A robot token is enough.

## Token

1. Open [expo.dev](https://expo.dev) → Account → Access tokens.
2. Create a token with access to the `uvel` project (`13230e71-d40b-45c8-8709-176f0c021198`).
3. Store it as the GitHub Actions secret **`EXPO_TOKEN`** on `allentackie-ops/uvel`.

The OTA workflow (`.github/workflows/ota.yml`) already reads `secrets.EXPO_TOKEN`. Never commit the token.

## Publish from GitHub (preferred)

1. Push the commits you want live to `main`.
2. GitHub → Actions → **OTA** → **Run workflow**.
3. Channel: `production` (default). Message: a short note of what changed.
4. Wait for `eas update` to finish. The new bundle is on the production channel.

Any agent with write access to this repo can do the same: dispatch the **OTA** workflow with `channel=production`.

```bash
gh workflow run ota.yml -f channel=production -f message="what changed"
```

## Publish from a shell

```bash
export EXPO_TOKEN=...          # the same secret
npx eas-cli update --channel production --message "what changed" --platform ios --non-interactive
```

`--non-interactive` is required so the token is used instead of a browser login.

## Channels

| Channel | Who gets it |
| --- | --- |
| `production` | App Store / TestFlight binaries built with the production profile |
| `preview` | Internal preview builds |
| `development` | Dev clients |

`eas.json` maps each build profile to a channel. A production OTA only reaches production binaries.

## After a native change

OTA cannot change native code, permissions, or the Expo SDK. If `app.json` plugins, `ios` / `android` config, or a native dependency changed, run an EAS **build** instead of an update.
