export const FACE_DESCRIPTOR_LENGTH = 128;
/** Euclidean distance — lower is a closer match (face-api default ~0.6). */
export const FACE_MATCH_THRESHOLD = 0.55;

export function parseFaceDescriptor(raw: unknown): number[] | null {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed) || parsed.length !== FACE_DESCRIPTOR_LENGTH) {
    return null;
  }
  if (!parsed.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return null;
  }
  return parsed as number[];
}

export function faceDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function isFaceMatch(stored: number[], probe: number[]): boolean {
  return faceDistance(stored, probe) <= FACE_MATCH_THRESHOLD;
}

export function faceMatchPercent(distance: number): number {
  const pct = Math.max(0, Math.min(100, (1 - distance / FACE_MATCH_THRESHOLD) * 100));
  return Math.round(pct);
}
