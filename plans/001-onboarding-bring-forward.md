# 001 — Settle the selected print into the onboarding gallery

| Status | Commit at planning | Severity | Category | Estimated scope |
| --- | --- | --- | --- | --- |
| Implemented · physical-device feel check pending | `8af5800` plus local changes | Low, visual polish | Spatial consistency | One gallery component and its existing interaction test |

## Problem

In onboarding’s **Picked for you** gallery, tapping a companion under **Also in your selection** promotes it to the large print. The caption responds and the image has a load fade. There is a small opportunity to connect the tap to the artwork itself. The interaction should feel like placing a print in an already mounted frame.

The current composition and selection handler in `expo/components/PickGallery.tsx:52` are:

```tsx
const framedPrint = <PrintWindow progress={progress} reduced={reduced} curtainColor={palette.programme}
  image={<>{print(lead)}{playable && <GlassPlayMark label="Watch" />}</>} />;
const browse = (pick: WeeklyPickSourceSuggestion) => {
  setSelectedId(pick.providerSourceId);
  onBrowse();
};
```

Both **Bring forward** and **Next pick** call that handler. The transition in this plan belongs to an explicit companion selection. **Next pick** cycles in place, and pagination remounts the gallery.

## Target

| Activation | First visible frame of the selected artwork | Finish | Timing |
| --- | --- | --- | --- |
| Tap or click on a companion | Centered scale 1.025, opacity 1 | Scale 1, opacity 1 | 220 ms, `motion.state`, `Easing.out(Easing.cubic)` |
| Same action with Reduce Motion | Scale 1, opacity 0.85 | Scale 1, opacity 1 | 100 ms, same curve |
| Keyboard or assistive activation | Scale 1, opacity 1 | Final immediately | 0 ms |

Clip the artwork to its existing 16:9 window. Only the image pixels change. The matte, play mark and focus outline keep their dimensions. Selection commits on press. The title, reason, Watch target and Follow target belong to the new pick immediately, even on a slow connection.

## Repository conventions

- Use the existing `motion.state` in `expo/constants/motion.ts:2`. The Reanimated timing, cancellation and reduced-opacity precedent is `expo/components/motion/ActionReveal.tsx:24`.
- Classify the original press synchronously with `isPointerActivation` from `expo/components/motion/pointerActivation.ts`. Use `useMotionVisibility` for route focus and foreground state, and the existing live Reduce Motion preference.
- `PrintWindow` already clips children in `expo/components/motion/PersonalizedPreview.tsx`. `MediaImage` forwards Expo Image load events to both the source and bundled poster fallback. Use those local extension points.

## Implementation steps

1. **Record the user action.** In `PickGallery.tsx:96`, pass the event from the companion press into selection. Track a monotonically increasing selection revision and its input type. Increment the revision on every browse, including **Next pick**, to invalidate older load callbacks. Keep the shared `setSelectedId` and `onBrowse()` behavior. Give hooks a consistent order before the empty-gallery return, or keep artwork hooks in a local child component.
2. **Isolate the print.** Inside the existing `PrintWindow`, wrap only the featured `MediaImage` in an animated view. Render `GlassPlayMark` as its sibling. Keep the parent Watch pressable and its focus target mounted. Key the promoted image instance by selection revision so a previous image’s callback cannot be mistaken for the current one. Companion thumbnails continue to render normally.
3. **Start from image readiness.** For an eligible promotion, initialize the artwork at the first-frame values above before it paints. Use the featured image’s `onLoad` to start timing once for the active revision, including a successfully loaded bundled poster. Pass `transition={0}` for this promoted image so the default 140 ms image fade does not overlap the authored transition. For keyboard and assistive promotion, render the final values and use a zero image transition. A failed image with no displayable fallback stays at rest. Playback and browsing never wait for `onLoad`.
4. **Handle interruptions.** Cancel the previous timing and discard stale load callbacks on each new selection. Consume pending motion on blur, background or unmount. If the motion preference changes mid-transition, settle immediately. If someone browses during the initial 840 ms gallery entrance, settle that entrance on interaction and retain its once-per-gallery presentation bookkeeping. A restored page or a Follow update cannot trigger a promotion.
5. **Preserve keyboard continuity.** The selected companion leaves the shelf. On keyboard promotion, move focus after the selection commit to the new Watch control, or the featured heading when the pick cannot play. Keep the chosen title available to assistive technology as soon as selection commits. Gate the existing caption change motion for instant activation. Mouse and touch promotion keep the current scroll behavior.

## Boundaries

Keep the changes local to the onboarding gallery and its interaction test. Preserve the authored first arrival, existing print assets, recommendation order, page navigation, and Watch and Follow actions. The stage and its glass button use their current geometry throughout. Use the installed animation libraries.

## Verification

- In `expo/components/ReviewRefinements.test.ts:147`, extend the existing gallery test with late load events. Select B, cycle to C, then deliver B’s callback. C must keep its title, Watch target and settled artwork. Repeat with A → B → A to catch implementations that check only the source ID. Selecting a companion must still produce zero Watch or Follow calls.
- From `expo/`, run `npm run typecheck`, `npm run lint`, and `bun test components/ReviewRefinements.test.ts`.
- Open the welcome preview with sample picks, wait for the first gallery arrival, then tap a companion. Record the promotion at phone width and inspect it at quarter speed. The visible crop should open out from the center over 220 ms. The matte edge and the glass triangle should stay on the same pixels. Repeat during the opening reveal and with two rapid selections.
- Exercise a slow remote poster and a failed URL with a bundled fallback. While the artwork loads, activate Watch for the new pick and confirm its identity. Reopen the gallery and verify that returning does not replay the promotion.
- Enable Reduce Motion and check the 100 ms opacity-only response. With a keyboard, activate **Bring forward** and check immediate presentation, visible focus and a usable next Tab stop. Verify touch timing on a physical phone before approving the feel.
