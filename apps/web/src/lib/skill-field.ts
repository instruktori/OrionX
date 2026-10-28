/** Deterministic scene geometry. All coordinates are normalized to the field. */
export type FieldPoint = { x: number; y: number; z: number; rootX: number; rootY: number };
export const FIELD_COUNT = 150;
export function fieldPoint(index: number, format: number): FieldPoint {
  const t = index / (FIELD_COUNT - 1);
  const angle = index * 2.399963229728653;
  if (format === 1) {
    const cluster = index % 3;
    const center = [[-.25, -.12], [.23, -.02], [0, .23]][cluster];
    const radius = .08 + Math.sqrt((index % 50) / 50) * .19;
    return { x: center[0] + Math.cos(angle) * radius, y: center[1] + Math.sin(angle) * radius * .78, z: Math.sin(angle * .7) * .25, rootX: center[0], rootY: center[1] };
  }
  if (format === 2) {
    const theta = t * Math.PI * 5;
    const radius = .17 + Math.sin(t * Math.PI) * .16;
    return { x: Math.cos(theta) * radius, y: -.35 + t * .72, z: Math.sin(theta) * .35, rootX: 0, rootY: -.35 + t * .72 };
  }
  const radius = .12 + Math.sqrt(t) * .29;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: Math.sin(angle * 1.3) * .32, rootX: 0, rootY: 0 };
}
