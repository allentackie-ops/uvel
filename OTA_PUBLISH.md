# Publishing a Uvel OTA update without browser login

The Expo browser login can time out in this environment. The safer alternative is to publish from a machine where you are already authenticated, or to use an Expo access token in the shell without sending it through chat.

## Option A: Publish locally while signed in to EAS

From the repository root:

```bash
npm install
npx eas-cli login --no-browser
npx eas-cli update --channel production --message "Verified analytics and account deletion"
```

The CLI will ask for the Expo account credentials in your terminal. Do not paste the password into chat.

## Option B: Publish with an Expo access token

Create an access token in the Expo account security settings, then set it only in your local shell:

```bash
export EXPO_TOKEN='your-token'
npx eas-cli update --channel production --message "Verified analytics and account deletion"
unset EXPO_TOKEN
```

Do not commit the token, add it to the mobile app, or include it in a support message. If the token has been exposed, revoke it and create a new one.

## Important compatibility notes

The app uses `runtimeVersion.policy = appVersion`, so this update targets installed binaries whose app version is `1.0.0`. OTA updates can deliver JavaScript and bundled assets, but they do not deploy Firebase Functions or Firestore rules. Before testing real analytics or account deletion, deploy the backend separately:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions,firestore:rules
```

Then configure `STRIPE_WEBHOOK_SECRET` and `PAYSTACK_WEBHOOK_SECRET` and register the webhook endpoints described in `REAL_ANALYTICS_SETUP.md`.

The intended EAS channel is `production`, matching `eas.json`.
