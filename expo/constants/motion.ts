/** Feedback, spatial continuity, and signature moments. Navigation keeps OS timing. */
export const motion = { choice: 180, state: 220, confirm: 360, reorder: 380, reveal: 720, ending: 680, introduction: 640, artwork: 520, artworkReturn: 380, chart: 560 } as const;
export const motionSpring = { stiffness: 230, damping: 26, mass: 1 } as const;
