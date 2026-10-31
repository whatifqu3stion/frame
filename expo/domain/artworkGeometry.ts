export type ArtworkRect = { x: number; y: number; width: number; height: number };
export function validArtworkRect(rect: ArtworkRect): boolean {
  return Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0;
}
/** Transform around the destination centre without animated layout or stretching the print. */
export function artworkTransform(from: ArtworkRect, to: ArtworkRect) {
  return { x: from.x + from.width / 2 - to.x - to.width / 2, y: from.y + from.height / 2 - to.y - to.height / 2, scale: from.width / to.width };
}
export function chartDayAt(x: number, width: number, count: number): number {
  if (!Number.isFinite(x) || width <= 0 || count <= 0) return -1;
  return Math.max(0, Math.min(count - 1, Math.floor(x / width * count)));
}
