// src/services/reportService.ts

import { PrismaClient } from "@prisma/client";
import { computeTAIScores, computeRadarData } from "../utils/taiRadar";
import { callLLM } from "../utils/llm";
import { loadPromptConfig } from "../config/promptConfig";

const prisma = new PrismaClient();

// ---------------------------------------------
// 額外：每題狀態分類（用 type，不用 interface）
// ---------------------------------------------
type QuestionStatus = "FULLY_MET" | "MOSTLY_MET" | "PARTIALLY_MET" | "NOT_MET" | "NA";

// 顯示用：指標名稱對照（可以之後再調整）
const axisDisplayName: Record<string, string> = {
  SAFETY: "安全性 Safety",
  PRIVACY: "隱私保護 Privacy",
  ACCURACY: "準確性 Accuracy",
  AUTONOMY: "自主性 Autonomy",
  FAIRNESS: "公平性 Fairness",
  SECURITY: "資安防護 Security",
  RESILIENCE: "韌性 Resilience",
  RELIABILITY: "可靠性 Reliability",
  TRANSPARENCY: "透明性 Transparency",
  ACCOUNTABILITY: "問責性 Accountability",
  EXPLAINABILITY: "可解釋性 Explainability",
};

// 小工具：把某一個軸的所有題目資料，轉成一段「有結構的」報告文字（Markdown）
function buildAxisStatsText(
  axis: string,
  items: {
    order: number;
    questionText: string;
    status: QuestionStatus;
    isNo: boolean;
  }[]
): string {
  const displayName = axisDisplayName[axis] ?? axis;

  const fully = items.filter((q) => q.status === "FULLY_MET");
  const mostly = items.filter((q) => q.status === "MOSTLY_MET");
  const partially = items.filter((q) => q.status === "PARTIALLY_MET");
  const notMet = items.filter((q) => q.status === "NOT_MET");
  const na = items.filter((q) => q.status === "NA");
  const noItems = items.filter((q) => q.isNo);

  const total = items.length;
  const included = total - na.length;

  const lines: string[] = [];

  // === 標題 & 整體統計 ===
  lines.push(`**${displayName} 填答統計** ➡️ 被採計題目數：${included}/${total} 題`);
  lines.push("");

  // 小工具：產生一個分類區塊（標題 + 題目清單）
  const pushQuestionBlock = (
    title: string,
    icon: string,
    arr: { order: number; questionText: string }[]
  ) => {
    if (!arr || arr.length === 0) return;
    const sorted = [...arr].sort((a, b) => a.order - b.order);

    lines.push(`**${icon} ${title}（${sorted.length} 題）**`);
    sorted.forEach((q) => {
      lines.push(`- Q${q.order}. ${q.questionText}`);
    });
    lines.push("");
  };

  // === 各分類詳細清單 ===
  pushQuestionBlock("有做到的題目", "✅", fully);
  pushQuestionBlock("大部分做到的題目", "🟡", mostly);
  pushQuestionBlock("部分做到的題目", "🟠", partially);
  pushQuestionBlock("尚未做到的題目", "❌", notMet);
  pushQuestionBlock("不適用的題目", "🚫", na);

  return lines.join("\n");
}

export class ReportService {
  /**
   * 從一個 Response（含 answers / question / option）建立各指標的填答統計 Markdown
   */
  buildQuestionStatsFromResponse(response: any): Record<string, string> {
    const axisQuestionsMap: Record<
      string,
      { order: number; questionText: string; status: QuestionStatus; isNo: boolean }[]
    > = {};

    for (const a of response.answers ?? []) {
      let scoreRaw: number | null = null;

      if (a.value !== null && a.value !== undefined) {
        scoreRaw = Number(a.value);
      } else if (
        a.option &&
        a.option.value !== null &&
        a.option.value !== undefined
      ) {
        scoreRaw = Number(a.option.value);
      }

      // 完全沒有數值（例如純文字問答）就先略過，不列入統計
      if (scoreRaw === null || isNaN(scoreRaw)) continue;

      const axis = a.question.category;
      const order = a.question.order;
      const questionText = a.question.text;
      const optionText = a.option ? a.option.text : "";

      // 判斷「是否為否」
      const normalizedOption = optionText.trim();
      const isNo =
        normalizedOption === "否" ||
        normalizedOption === "No" ||
        normalizedOption === "NO" ||
        normalizedOption === "no";

      // 判斷分數區間
      let status: QuestionStatus;
      if (scoreRaw === -1) {
        status = "NA";
      } else {
        const scoreNormalized = scoreRaw / 100;
        if (scoreNormalized >= 0.8) {
          status = "FULLY_MET";
        } else if (scoreNormalized >= 0.6) {
          status = "MOSTLY_MET";
        } else if (scoreNormalized >= 0.4) {
          status = "PARTIALLY_MET";
        } else {
          status = "NOT_MET";
        }
      }

      if (!axisQuestionsMap[axis]) {
        axisQuestionsMap[axis] = [];
      }
      axisQuestionsMap[axis].push({
        order,
        questionText,
        status,
        isNo,
      });
    }

    const questionStatsText: Record<string, string> = {};
    for (const [axis, items] of Object.entries(axisQuestionsMap)) {
      questionStatsText[axis] = buildAxisStatsText(axis, items);
    }

    return questionStatsText;
  }

  /**
   * 為指定 responseId 生成（或更新）一份 Report：
   * 1. 從 Response + Answer 計算各軸 TAI 分數 (0–1)
   * 2. 呼叫 LLM 生成 analysisText
   * 3. upsert 到 Report table（依 responseId 唯一）
   * 4. 回傳：report record + radarData + scores + overallScore + analysisText
   */
  async generateReport(responseId: number) {
    // 1) 取得 Response + Answers + Project TAI 排序
    const response = await prisma.response.findUnique({
      where: { id: responseId },
      include: {
        answers: { include: { question: true, option: true } },
        project: {
          include: {
            taiOrders: true,
          },
        },
      },
    });

    if (!response) {
      throw new Error("Response not found");
    }

    // ============================================================
    // 2) 整理答案 -> { axis, value }（給 TAI 分數用）
    // ============================================================
    const cleanedAnswers = response.answers
      .map((a) => {
        let score: number | null = null;

        if (a.value !== null && a.value !== undefined) {
          score = Number(a.value);
        } else if (
          a.option &&
          a.option.value !== null &&
          a.option.value !== undefined
        ) {
          score = Number(a.option.value);
        }

        // -1 表示 N/A，仍保留給 computeTAIScores 處理
        if (score === null) return null;

        return {
          axis: a.question.category,
          value: score,
        };
      })
      .filter(
        (item): item is { axis: string; value: number } => item !== null
      );

    // 3) 計算各軸平均分數 (0–1, 或 -1 表示 N/A)
    const taiScores = computeTAIScores(cleanedAnswers);

    // 4) 轉成 radarData 給前端畫圖用
    const radarData = computeRadarData(taiScores);

    // ============================================================
    // 2-2) 題目層級統計：組成後端直接輸出的 Markdown 字串
    // ============================================================
    const questionStatsText = this.buildQuestionStatsFromResponse(response);

    // ============================================================
    // 5) 準備權重 Snapshot & 計算 Overall Score
    //    - 若 ProjectTAIPriority.weight 有值 -> 使用者自訂 (已正規化 0~1)
    //    - 否則 -> 11 個指標等權重
    // ============================================================

    const taiOrders = response.project?.taiOrders || [];

    const weightMap: Record<string, number> = {};
    const hasProjectConfig = taiOrders.length > 0;

    // 檢查是否有至少一個 weight 被設定（非 null / undefined）
    const hasUserDefinedWeights = taiOrders.some(
      (item) => item.weight !== null && item.weight !== undefined
    );

    if (hasProjectConfig) {
      if (hasUserDefinedWeights) {
        // ========= 模式 A：使用者有填 weight，且前端已正規化成 0~1 =========
        taiOrders.forEach((item) => {
          const w = item.weight;
          const num = w !== null && w !== undefined ? Number(w) : 0;
          weightMap[item.indicator] = !isNaN(num) ? num : 0;
        });
      } else {
        // ========= 模式 B：使用者完全沒填 weight -> 11 軸等權重 =========
        const equalWeight = taiOrders.length > 0 ? 1 / taiOrders.length : 0;
        taiOrders.forEach((item) => {
          weightMap[item.indicator] = equalWeight;
        });
      }
    }

    // -------------------- 開始計算加權平均 --------------------
    let totalWeightedScore = 0;
    let totalValidWeight = 0;

    for (const [axis, score] of Object.entries(taiScores)) {
      // 遇到 N/A (-1) 或 NaN，直接跳過
      if (score === -1 || isNaN(score)) {
        continue;
      }

      let weight: number;

      if (hasProjectConfig && Object.keys(weightMap).length > 0) {
        // 有專案設定（自訂權重或等權重），若沒找到就當 0
        weight = weightMap[axis] ?? 0;
      } else {
        // 完全沒有 taiOrders 設定 -> 純算術平均
        weight = 1;
      }

      if (weight <= 0) continue;

      totalWeightedScore += score * weight;
      totalValidWeight += weight;
    }

    const overallScore =
      totalValidWeight > 0 ? totalWeightedScore / totalValidWeight : 0;

    // --------- 權重快照：存「正規化後」的權重（和為 1），若沒有設定就存 null ---------
    let taiWeightSnapshot: Record<string, number> | null = null;

    if (hasProjectConfig && Object.keys(weightMap).length > 0) {
      // 為了保險起見，再把 weightMap 正規化一次（避免浮點誤差）
      const sumWeights = Object.values(weightMap).reduce(
        (acc, v) => acc + (isNaN(v) ? 0 : v),
        0
      );

      if (sumWeights > 0) {
        taiWeightSnapshot = Object.fromEntries(
          Object.entries(weightMap).map(([k, v]) => [k, v / sumWeights])
        );
      } else {
        taiWeightSnapshot = weightMap;
      }
    }

    console.log("TAI scores:", taiScores);
    console.log("Weight Map (final used):", weightMap);
    console.log("Total Weighted Score:", totalWeightedScore);
    console.log("Total Valid Weight:", totalValidWeight);
    console.log("Overall Score (Weighted):", overallScore);

    // 6) 建立 LLM prompt
    const prompt = this.buildLLMPrompt(taiScores);

    // 7) 呼叫 LLM
    const analysisText = await callLLM(prompt);

    // 8) upsert 進 Report table
    const modelUsed = "openai/gpt-oss-20b:free";

    const reportRecord = await prisma.report.upsert({
      where: { responseId },
      update: {
        overallScore,
        analysisText,
        radarData: taiScores,
        taiWeightSnapshot, // 存入權重快照
        llmMeta: {
          model: modelUsed,
          provider: "openrouter",
          updatedAt: new Date().toISOString(),
        },
      },
      create: {
        responseId,
        overallScore,
        analysisText,
        radarData: taiScores,
        taiWeightSnapshot, // 存入權重快照
        llmMeta: {
          model: modelUsed,
          provider: "openrouter",
          createdAt: new Date().toISOString(),
        },
      },
      include: {
        response: {
          select: {
            id: true,
            user: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
            version: { select: { id: true, title: true } },
          },
        },
        images: true,
      },
    });

    return {
      report: reportRecord,
      radarData,
      scores: taiScores,
      overallScore,
      analysisText,
      // ⭐ 每個指標對應的一段 Markdown 統計文字
      questionStatsText,
    };
  }

  /**
   * 建立 LLM Prompt
   */
  buildLLMPrompt(scores: Record<string, number>) {
    let promptConfig: any = {};
    try {
      promptConfig = loadPromptConfig();
    } catch (err) {
      console.error("FAILED TO LOAD prompt.json:", err);
      promptConfig = {};
    }

    const background = promptConfig?.background ?? "";

    const axisStatus: string[] = [];

    // 過濾掉 -1 (N/A) 的軸，只對有效軸排序
    const validScores = Object.entries(scores)
      .filter(([, score]) => score !== -1 && !isNaN(score))
      .sort(([, a], [, b]) => b - a);

    for (const [axis, score] of validScores) {
      const percentage = (score * 100).toFixed(0);
      let status: string;

      if (score >= 0.8) {
        status = `[完全符合] ${axis}：達成度 ${percentage}%`;
      } else if (score >= 0.6) {
        status = `[大部分符合] ${axis}：達成度 ${percentage}%`;
      } else if (score >= 0.4) {
        status = `[部分符合] ${axis}：達成度 ${percentage}%`;
      } else {
        status = `[尚未達成] ${axis}：達成度 ${percentage}%`;
      }
      axisStatus.push(status);
    }

    const naAxes = Object.entries(scores).filter(([, score]) => score === -1);
    if (naAxes.length > 0) {
      axisStatus.push(`\n以下面向因問答數量為零，標註為「不適用 (N/A)」：`);
      naAxes.forEach(([axis]) => {
        axisStatus.push(`[不適用] ${axis}`);
      });
    }

    const statusList = axisStatus.join("\n* ");

    return `
${background}

以下是本次評估的 11 個可信賴 AI 倫理指標的符合程度（由高至低）：

* ${statusList}

請根據您作為「可信任 AI 顧問」的角色，並依據 System Prompt 中要求的格式（改善建議段落 + Markdown 表格計畫，表格計畫包含3個分別為短期 (1–4 週)、中期 (1–3 個月)、長期 (3–12 個月)，並且每個分別生出「階段、目標、主要工作、產出與驗收標準」這四個，並輸出分析報告(請用繁體中文回答)。
    `;
  }
}

export const reportService = new ReportService();