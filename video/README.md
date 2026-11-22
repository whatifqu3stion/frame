# Frame grounded symbol animation

The in-app **How Frame works** film is a separate composition called `ViewingGuide`. Run `npm run render:guide` from this directory to build `expo/assets/welcome/viewing-guide.mp4`. Its four seven-second chapters share their copy with the app’s readable introduction in `expo/constants/introduction.json`. The artwork and fonts are local; no Google account or external media service is used.

Six-second, silent 3D logo animation at 1080 × 1440, 30 fps. The current version contains **no wordmark, subtitles, or other text**. The mineral-blue symbol settles above a transparent ground plane, with a subtle real-time cast shadow beneath it.

## Current deliverables

- `out/frame-symbol-soft-shadow-preview.mp4`: warm stone background for review.
- `out/frame-symbol-grounded-alpha.webm`: transparent symbol and translucent shadow.
- `out/frame-symbol-grounded-master.mov`: ProRes 4444 alpha editing master.
- `out/frame-symbol-soft-shadow-poster.png`: transparent reduced-motion fallback.
- `out/frame-symbol-grounded-square.webm`: 1080 × 1080 transparent version.

Previous `frame-onboarding-*` exports are the earlier text-bearing version. Current render scripts produce the new `frame-symbol-grounded-*` assets.

## Design and motion

The geometry preserves the reference's rectangular opening and eight surrounding marks. Beveled edges, mineral blue from `expo/constants/theme.ts`, a studio reflection environment, and warm/cool lights provide depth. The high key light produces a broadly softened shadow set farther beneath the symbol; only the shadow is visible on the receiving plane, so the background remains transparent. The symbol is centered in the composition and the outer marks settle above the ground. The shadow catcher is lowered to y = −3.07 and its PCF filter radius is 24, giving a visible air gap and a softer edge.

The entrance fades in over 0.6 seconds; the eight marks move into place over approximately two seconds. The rotation settles and the final pose holds through six seconds. All animation derives from frame numbers, with no timers or randomness.

## Edit and render

```sh
cd video
npm ci
npm run dev
npm run typecheck
npm run render:preview
npm run render:alpha
npm run render:master
npx remotion still src/index.ts FramePoster out/frame-symbol-soft-shadow-poster.png
npx remotion render src/index.ts FrameSymbol out/frame-symbol-grounded-square.webm --codec=vp9 --pixel-format=yuva420p --image-format=png
```

Append `--browser-executable=/absolute/path/to/chrome` when using an existing custom browser. The composition itself uses no remote assets.

`src/LogoScene.tsx` controls geometry, lighting, ground shadow, and movement. `src/FrameIntro.tsx` controls entrance opacity and optional preview backgrounds. `src/brand.ts` holds theme values and output settings. Registered compositions are `FrameTransparent`, `FramePreview`, `FrameDarkPreview`, `FrameSymbol` (square), and `FramePoster`.

## Onboarding handoff

Play once and hold the final pose; use the poster for reduced motion. Expo onboarding integration remains separate. WebM alpha needs target-device playback validation; ProRes is an editing master. The shadow uses translucent dark pixels, so it composites naturally onto light surfaces and is less visible on dark ones. The preview MP4 is opaque by design.

Technical references: [Remotion transparency](https://www.remotion.dev/docs/transparent-videos) and [frame-synchronized ThreeCanvas](https://www.remotion.dev/docs/three-canvas).
