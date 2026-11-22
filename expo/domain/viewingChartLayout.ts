export function compactViewingHistory(width: number, height: number, fontScale: number) {
  return width < 360 || (width < 600 && (height < 740 || fontScale > 1.3));
}

export function viewingChartLayout(width: number, fontScale: number, count = 7) {
  const minimum = Math.max(48, 32 * fontScale);
  const viewport = width > 0 ? width : minimum * count;
  const visibleDays = Math.max(1, Math.min(count, Math.floor(viewport / minimum)));
  const dayWidth = Math.max(minimum, viewport / visibleDays);
  return { visibleDays, dayWidth, plotWidth: dayWidth * count, overflow: visibleDays < count };
}

export function viewingChartOffset(index: number, visibleDays: number, dayWidth: number, count = 7) {
  const first = Math.max(0, Math.min(count - visibleDays, index - Math.floor(visibleDays / 2)));
  return first * dayWidth;
}
