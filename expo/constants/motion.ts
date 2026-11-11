/** Feedback, spatial continuity, and signature moments. Navigation keeps OS timing. */
export const motion = { choice: 180, state: 220, confirm: 360, reorder: 380, reveal: 720, ending: 680, introduction: 1600, artwork: 520, roomDim: 1720, roomRestore: 320, chart: 560, printArrange: 720, printLight: 9000, galleryArrival: 840 } as const;
export const motionSpring = { stiffness: 230, damping: 26, mass: 1 } as const;
