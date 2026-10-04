// Adapted from Mentora (MIT), Copyright (c) 2026 Hamza Ali.
// See docs/MENTORA-LICENSE.txt and docs/reuse.md.
/** Arrowhead wings for the last segment of an arrow, in local coords. */
export function arrowHead(points: number[], size = 14): number[] | null {
  if (points.length < 4) return null;
  const x2 = points[points.length - 2] ?? 0;
  const y2 = points[points.length - 1] ?? 0;
  const x1 = points[points.length - 4] ?? 0;
  const y1 = points[points.length - 3] ?? 0;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const spread = Math.PI / 7;
  return [
    x2 - size * Math.cos(angle - spread),
    y2 - size * Math.sin(angle - spread),
    x2,
    y2,
    x2 - size * Math.cos(angle + spread),
    y2 - size * Math.sin(angle + spread),
  ];
}
