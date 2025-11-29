// utils/taiRadar.ts

/** TAI 分數 (0–1) */
export function computeTAIScores(
  answers: { axis: string; value: number }[]
): Record<string, number> {
  const byAxis: Record<string, number[]> = {};

  for (const a of answers) {
    if (!byAxis[a.axis]) byAxis[a.axis] = [];
    byAxis[a.axis].push(a.value / 100);
  }

  const scores: Record<string, number> = {};
  for (const axis in byAxis) {
    const arr = byAxis[axis];
    const avg = arr.reduce((s, x) => s + x, 0) / arr.length;
    scores[axis] = Number(avg.toFixed(4));
  }

  return scores;
}

// return radar data format for frontend
export function computeRadarData(scores: Record<string, number>) {
  const radar: Record<string, number> = {};

  for (const axis in scores) {
    radar[axis] = Number(scores[axis].toFixed(4)); // 0–1
  }

  return radar;
}
