// utils/taiRadar.ts

/** TAI 分數 (0–1) */
export function computeTAIScores(
  answers: { axis: string; value: number }[]
): Record<string, number> {
  // 1. 先將所有原始分數 (包含 -1) 依照 axis 分組
  const byAxis: Record<string, number[]> = {};

  for (const a of answers) {
    if (!byAxis[a.axis]) byAxis[a.axis] = [];
    // 這裡先存原始分數 (例如 100, 0, 或 -1)，等一下再處理
    byAxis[a.axis].push(a.value);
  }

  const scores: Record<string, number> = {};

  // 2. 針對每一組 axis 計算
  for (const axis in byAxis) {
    const rawValues = byAxis[axis];
    
    let currentSum = 0;             // 分子：有效分數總和 (0-1範圍)
    let divisor = rawValues.length; // 分母：初始被除數 (題目總數)

    for (const val of rawValues) {
      // 先檢查是否有 -1
      if (val === -1) {
        // 有的話，把最後下面的被除數減 1
        divisor = divisor - 1;
        // (且不將此分加入 currentSum)
      } else {
        // 正常的題目：將分數正規化 (除以100) 後加入總和
        currentSum += (val / 100);
      }
    }

    // 依照您的要求：當最後被除數是 0 時，則回傳 -1
    if (divisor === 0) {
      scores[axis] = -1;
    } else {
      // 計算平均
      const avg = currentSum / divisor;
      scores[axis] = Number(avg.toFixed(4));
    }
  }

  return scores;
}

// return radar data format for frontend
export function computeRadarData(scores: Record<string, number>) {
  const radar: Record<string, number> = {};

  for (const axis in scores) {
    radar[axis] = Number(scores[axis].toFixed(4)); // 0–1 (or -1 for N/A)
  }

  return radar;
}
