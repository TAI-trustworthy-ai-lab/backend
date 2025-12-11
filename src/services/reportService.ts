// src/services/reportService.ts

import { PrismaClient, Prisma } from "@prisma/client";
import { computeTAIScores, computeRadarData, TAIIndicator } from "../utils/taiRadar";
import { callLLM } from "../utils/llm";
import { loadPromptConfig } from "../config/promptConfig";

const prisma = new PrismaClient();

/**
 * 題目狀態分類
 */
type QuestionStatus =
  | "FULLY_MET"
  | "MOSTLY_MET"
  | "PARTIALLY_MET"
  | "NOT_MET"
  | "NA";

/**
 * 顯示名稱（可自行調整）
 */
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

/**
 * 建立文字統計 Markdown
 */
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

  const total = items.length;
  const included = total - na.length;

  const lines: string[] = [];
  lines.push(`**${displayName} 填答統計** ➡️ 被採計題目數：${included}/${total} 題\n`);

  const pushBlock = (
    title: string,
    icon: string,
    arr: { order: number; questionText: string }[]
  ) => {
    if (arr.length === 0) return;
    const sorted = [...arr].sort((a, b) => a.order - b.order);

    lines.push(`**${icon} ${title}（${sorted.length} 題）**`);
    sorted.forEach((q) => lines.push(`- Q${q.order}. ${q.questionText}`));
    lines.push("");
  };

  pushBlock("有做到的題目", "✅", fully);
  pushBlock("大部分做到的題目", "🟡", mostly);
  pushBlock("部分做到的題目", "🟠", partially);
  pushBlock("尚未做到的題目", "❌", notMet);
  pushBlock("不適用的題目", "🚫", na);

  return lines.join("\n");
}

export class ReportService {
  /**
   * 依 Response 建立題目統計 Markdown
   */
  buildQuestionStatsFromResponse(response: any): Record<string, string> {
    const axisMap: Record<
      string,
      { order: number; questionText: string; status: QuestionStatus; isNo: boolean }[]
    > = {};

    for (const a of response.answers ?? []) {
      let raw: number | null = null;

      if (a.value !== undefined && a.value !== null) {
        raw = Number(a.value);
      } else if (a.option?.value !== undefined && a.option?.value !== null) {
        raw = Number(a.option.value);
      }

      if (raw === null || isNaN(raw)) continue;

      const axis = a.question.category as TAIIndicator;
      const order = a.question.order;
      const text = a.question.text;
      const optionText = (a.option?.text ?? "").trim();

      const isNo =
        optionText === "否" ||
        optionText.toLowerCase() === "no";

      let status: QuestionStatus;

      if (raw === -1) {
        status = "NA";
      } else {
        const norm = raw / 100;
        if (norm >= 0.8) status = "FULLY_MET";
        else if (norm >= 0.6) status = "MOSTLY_MET";
        else if (norm >= 0.4) status = "PARTIALLY_MET";
        else status = "NOT_MET";
      }

      if (!axisMap[axis]) axisMap[axis] = [];
      axisMap[axis].push({ order, questionText: text, status, isNo });
    }

    const output: Record<string, string> = {};
    for (const [axis, items] of Object.entries(axisMap)) {
      output[axis] = buildAxisStatsText(axis, items);
    }
    return output;
  }

  /**
   * 產生 TAI Report
   */
  async generateReport(responseId: number) {
    const response = await prisma.response.findUnique({
      where: { id: responseId },
      include: {
        answers: { include: { question: true, option: true } },
        project: { include: { taiOrders: true } },
      },
    });

    if (!response) throw new Error("Response not found");

    // ----------------------------------------------------
    // 1) 整理答案給 computeTAIScores
    // ----------------------------------------------------
    const cleanedAnswers: { axis: TAIIndicator; value: number }[] =
      response.answers
        .map((a) => {
          let score: number | null = null;

          if (a.value !== null && a.value !== undefined) {
            score = Number(a.value);
          } else if (a.option?.value !== null && a.option?.value !== undefined) {
            score = Number(a.option.value);
          }

          if (score === null) return null;

          return {
            axis: a.question.category as TAIIndicator,
            value: score,
          };
        })
        .filter(
          (x): x is { axis: TAIIndicator; value: number } => x !== null
        );

    // 2) 計算 TAI 分數（0–1 或 -1）
    const taiScores = computeTAIScores(cleanedAnswers);

    // 3) Radar Data
    const radarData = computeRadarData(taiScores);

    // 4) 題目統計 Markdown
    const questionStatsText = this.buildQuestionStatsFromResponse(response);

    // ----------------------------------------------------
    // 5) 計算 Overall Score（含專案設定權重）
    // ----------------------------------------------------
    const taiOrders = response.project?.taiOrders ?? [];
    const hasWeights = taiOrders.some((o) => o.weight !== null && o.weight !== undefined);

    const weightMap: Record<string, number> = {};

    if (taiOrders.length > 0) {
      if (hasWeights) {
        taiOrders.forEach((o) => {
          weightMap[o.indicator] = Number(o.weight ?? 0);
        });
      } else {
        const w = 1 / taiOrders.length;
        taiOrders.forEach((o) => {
          weightMap[o.indicator] = w;
        });
      }
    }

    let total = 0;
    let totalW = 0;

    for (const [axis, score] of Object.entries(taiScores)) {
      if (score === -1 || isNaN(score)) continue;

      const w = weightMap[axis] ?? 1;
      total += w * score;
      totalW += w;
    }

    const overallScore = totalW > 0 ? total / totalW : 0;

    // ----------------------------------------------------
    // 6) 權重快照 (Prisma JSON)
    // ----------------------------------------------------
    let taiWeightSnapshot: Prisma.JsonObject | null = null;

    if (Object.keys(weightMap).length > 0) {
      const sum = Object.values(weightMap).reduce((a, b) => a + b, 0);

      if (sum > 0) {
        taiWeightSnapshot = Object.fromEntries(
          Object.entries(weightMap).map(([k, v]) => [k, v / sum])
        ) as Prisma.JsonObject;
      } else {
        taiWeightSnapshot = weightMap as Prisma.JsonObject;
      }
    }

    // ----------------------------------------------------
    // 7) LLM Prompt
    // ----------------------------------------------------
    const prompt = this.buildLLMPrompt(taiScores);

    const analysisText = await callLLM(prompt);
    const modelUsed = "openai/gpt-oss-20b:free";

    // ----------------------------------------------------
    // 8) Upsert report record
    // ----------------------------------------------------
    const report = await prisma.report.upsert({
      where: { responseId },
      update: {
        overallScore,
        analysisText,
        radarData: taiScores,
        taiWeightSnapshot: taiWeightSnapshot as Prisma.InputJsonValue,
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
        taiWeightSnapshot: taiWeightSnapshot as Prisma.InputJsonValue,
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
      report,
      radarData,
      scores: taiScores,
      overallScore,
      analysisText,
      questionStatsText, // ⭐ 統計文字加入回傳
    };
  }

  /**
   * 建立 LLM Prompt
   */
  buildLLMPrompt(scores: Record<string, number>) {
    let config: any = {};
    try {
      config = loadPromptConfig();
    } catch (e) {
      console.error("FAILED TO LOAD prompt.json", e);
    }

    const background = config?.background ?? "";
    const lines: string[] = [];

    const valid = Object.entries(scores)
      .filter(([_, s]) => s !== -1 && !isNaN(s))
      .sort(([, a], [, b]) => b - a);

    valid.forEach(([axis, score]) => {
      const pct = (score * 100).toFixed(0);
      let status = "";

      if (score >= 0.8) status = `[完全符合] ${axis}：${pct}%`;
      else if (score >= 0.6) status = `[大部分符合] ${axis}：${pct}%`;
      else if (score >= 0.4) status = `[部分符合] ${axis}：${pct}%`;
      else status = `[尚未達成] ${axis}：${pct}%`;

      lines.push(status);
    });

    const NAaxes = Object.entries(scores).filter(([_, s]) => s === -1);
    if (NAaxes.length > 0) {
      lines.push("\n以下因無回答，被標記為不適用 (N/A)：");
      NAaxes.forEach(([axis]) => lines.push(`- ${axis}`));
    }

    return `
${background}

以下為 11 項可信任 AI 指標的符合程度（從高到低）：

${lines.map((l) => `* ${l}`).join("\n")}

請根據您作為「可信任 AI 顧問」的角色，並依據 System Prompt 中要求的格式（改善建議段落 + Markdown 表格計畫，表格計畫包含3個分別為短期 (1–4 週)、中期 (1–3 個月)、長期 (3–12 個月)，並且每個分別生出「階段、目標、主要工作、產出與驗收標準」這四個，並輸出分析報告(請用繁體中文回答)。
    `;
  }
}

export const reportService = new ReportService();
