# Founder Studio runtime test notes

The running local Expo web app opened `/brand/founder` successfully after the root route was entered with a local-only test session. The empty state showed the private project form and correctly explained that the work is not a public brand or verification application.

The form was filled with the project name `Noir Field` and a concept description, then submitted through the real UI. The screen advanced to the project home and displayed the saved project with `0 saved boards`, the six-stage journey, and Moodboard / Sketch canvas actions.

The Sketch canvas action was pressed through the real UI. The project immediately showed `1 saved boards`, stage changed to Design, and the rendered editor showed `SKETCH CANVAS`, `First garment sketch`, `Draw a rough silhouette or annotate an idea`, `+ Photo`, color swatches, `Clear`, and `Saved locally as you work`.

A pre-existing web-only `expo-file-system` `getInfoAsync` development overlay appeared during the app’s feed video prefetch. It is unrelated to Founder Studio and was dismissible; the Founder Studio route and create-project flow rendered underneath it.
