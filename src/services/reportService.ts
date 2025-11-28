import { PrismaClient } from "@prisma/client";
import { computeTAIScores, computeRadarData } from "../utils/taiRadar";
import { callLLM } from "../utils/llm";
import { loadPromptConfig } from "../config/prompt";

const prisma = new PrismaClient();

export class ReportService {

  /**
   * Generate a clean TAI report
   */
  async generateReport(responseId: number) {

    // 1) 取得 Response + Answers
    const response = await prisma.response.findUnique({
      where: { id: responseId },
      include: {
        answers: { include: { question: true } }
      }
    });

    if (!response) throw new Error("Response not found");

    // 2) 整理成乾淨格式
    const cleanedAnswers = response.answers.map(a => ({
      axis: a.question.category,   // axis
      value: Number(a.value)       // 0–100
    }));

    // 3) Step 1: 計算 TAI Score (0–1)
    const taiScores = computeTAIScores(cleanedAnswers);

    // 4) Step 2: radarData for frontend
    const radarData = computeRadarData(taiScores);

    // 5) overall score (0–1)
    const scoreValues = Object.values(taiScores);
    const overallScore = scoreValues.length
      ? scoreValues.reduce((s, x) => s + x, 0) / scoreValues.length
      : 0;

    // 6) Prompt → LLM
    const prompt = this.buildLLMPrompt(taiScores, overallScore);
    const analysisText = await callLLM(prompt);

    // 7) 回傳給 controller
    return {
      responseId,
      radarData,
      scores: taiScores,
      overallScore,
      analysisText,
    };
  }


  /**
   * Build LLM Prompt
   */
  buildLLMPrompt(scores: Record<string, number>, overallScore: number) {
    loadPromptConfig();

    return `
你是一位專業的可信任 AI（TAI）分析師。

以下是某次 AI 系統評估的結果（0–1）：

Overall Score:
${overallScore.toFixed(2)}

各面向分數：
${JSON.stringify(scores, null, 2)}

請基於這些資料，撰寫一份至少 150 字的專業分析，包含：

1. Overall Summary
2. Strengths（最高分的項目）
3. Weaknesses / Risks（最低分的項目）
4. Actionable Recommendations（至少 2–3 個具體建議）
    `;
  }
}

export const reportService = new ReportService();
