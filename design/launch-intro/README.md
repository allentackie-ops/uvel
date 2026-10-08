# Uvel launch micro-intro — “The swatch opens”

## Creative direction

A quiet, editorial reveal built around the approved Uvel parchment-and-thread logo. The screen starts on the same warm fibrous paper field. The exact square logo artwork opens from a narrow center seam to its full width, as if a textile swatch is gently unfurled; it settles without a bounce, spin, particles, slogan, or sound. The overlay then gives way to the real app screen as soon as the startup gate is ready.

| Time | Beat |
| --- | --- |
| 0–180 ms | Paper is already present; the center of the logo card begins to appear. |
| 180–460 ms | The card reveals symmetrically from its center seam to both edges. |
| 460–800 ms | Brief still hold so the red woven U reads clearly. |
| 800–1,000 ms | Fade into the app. If app setup takes longer, the card stays still and exits as soon as the app is ready. |

The React Native version preserves the exact logo artwork (`assets/icon.png`) and uses Reanimated for the reveal. It is not a generated logo animation. The portrait paper field is texture-only; the motion is authored in code.

## Why this approach

- Pinterest’s official App Store and Google Play listings describe visual discovery, shopping, boards, saving Pins, and collages. That supports borrowing its **visual-first restraint**, not copying its branding.
- Pinterest’s public launch-animation results were inspiration boards rather than reliable documentation of Pinterest’s own current startup sequence, so this concept does not claim to reproduce Pinterest’s actual app intro.
- Apple’s Human Interface Guidelines say to launch quickly, keep launch screens close to the first screen, and avoid making them an ad or branded “About” screen. This is a short in-app transition, with no copy, and it yields to the app when ready.
- Android’s official SplashScreen guidance recommends keeping logo animation to at most 1,000 ms. The animated reveal itself is 520 ms; the requested roughly one-second moment then hands off to the app. If Uvel’s startup gate takes longer, the mark simply holds still and fades as soon as that gate opens.

## Sources

- [Pinterest on the App Store](https://apps.apple.com/us/app/pinterest/id429047995)
- [Pinterest on Google Play](https://play.google.com/store/apps/details?id=com.pinterest&hl=en_US)
- [Apple Human Interface Guidelines — Launching](https://developer.apple.com/design/human-interface-guidelines/launching)
- [Android Developers — Splash screens](https://developer.android.com/develop/ui/views/launch/splash-screen)

## Files

- `launch-intro-preview.html` — deterministic browser preview source.
- `launch-intro-preview.mp4` — silent one-second vertical preview.
- `launch-intro-poster.jpg` — representative still from the settled-logo beat.
- `parchment-field.png` — portrait paper texture used by the app splash canvas.
