// utils/taiRadar.ts

/**
 * Compute average TAI scores per axis.
 * Input answers example:
 * [
 *   { axis: "Accuracy", value: 80 },
 *   { axis: "Accuracy", value: 60 },
 *   { axis: "Safety", value: 100 }
 * ]
 *
 * Output:
 * {
 *   Accuracy: 0.70,
 *   Safety: 1.00
 * }
 */
export function computeTAIScores(
  answers: { axis: string; value: number }[]
): Record<string, number> {
  const byAxis: Record<string, number[]> = {};

  for (const a of answers) {
    if (!byAxis[a.axis]) byAxis[a.axis] = [];
    byAxis[a.axis].push(a.value / 100); // convert 0–100 → 0–1
  }

  const scores: Record<string, number> = {};
  for (const axis in byAxis) {
    const arr = byAxis[axis];
    const avg = arr.reduce((s, x) => s + x, 0) / arr.length;
    scores[axis] = Number(avg.toFixed(4));
  }

  return scores;
}

/**
 * Convert category scores into radarData format (for frontend drawing).
 *
 * Input:
 * {
 *   Accuracy: 0.8,
 *   Safety: 0.6
 * }
 *
 * Output:
 * [
 *   { axis: "Accuracy", value: 0.8 },
 *   { axis: "Safety", value: 0.6 }
 * ]
 */
export function computeRadarData(scores: Record<string, number>) {
  return Object.entries(scores).map(([axis, value]) => ({
    axis,
    value: Number(value.toFixed(4)),
  }));
}
