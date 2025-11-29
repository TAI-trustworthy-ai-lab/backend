// src/services/reportService.ts

import { PrismaClient } from "@prisma/client";
import { computeTAIScores, computeRadarData } from "../utils/taiRadar";
import { callLLM } from "../utils/llm";
import { loadPromptConfig } from "../config/promptConfig";

const prisma = new PrismaClient();

export class ReportService {
  /**
   * 為指定 responseId 生成（或更新）一份 Report：
   * 1. 從 Response + Answer 計算各軸 TAI 分數 (0–1)
   * 2. 呼叫 LLM 生成 analysisText
   * 3. upsert 到 Report table（依 responseId 唯一）
   * 4. 回傳：report record + radarData + scores + overallScore + analysisText
   */
  async generateReport(responseId: number) {
    // 1) 取得 Response + Answers + Project TAI 排序（做 snapshot 用）
    const response = await prisma.response.findUnique({
      where: { id: responseId },
      include: {
        answers: { include: { question: true, option: true } },
        project: {
          include: {
            taiOrders: true, // ProjectTAIPriority[]
          },
        },
      },
    });

    if (!response) {
      throw new Error("Response not found");
    }

    // 2) 整理答案 -> { axis, value }
    // 2) 整理答案 -> { axis, value }
    // 支援 SCALE / SINGLE_CHOICE / MULTIPLE_CHOICE
    const cleanedAnswers = response.answers.map((a) => {
      let score: number | null = null;

      // case 1：Likert / SCALE 題（數值儲存在 Answer.value）
      if (a.value !== null && a.value !== undefined) {
        score = Number(a.value);
      }

      // case 2：單選題 / 多選題：從 option.value 取得分數
      else if (a.option && a.option.value !== null && a.option.value !== undefined) {
        score = Number(a.option.value);
      }

      if (score === -1) {
        score = 0; // treat null or -1 as 0 score
      }
      if (score === null) return null;

      return {
        axis: a.question.category,
        value: score, // 0 / 100 / -1
      };
    })  
    .filter(
      (item): item is { axis: string; value: number } => item !== null
    );

    // 3) 計算各軸平均分數 (0–1)
    const taiScores = computeTAIScores(cleanedAnswers);

    // 4) 轉成 radarData 給前端畫圖用
    const radarData = computeRadarData(taiScores);

    // 5) overall score (0–1)
    const scoreValues = Object.values(taiScores).filter((v) => !isNaN(v));
    const overallScore =
      scoreValues.length > 0
        ? scoreValues.reduce((s, x) => s + x, 0) / scoreValues.length
        : 0;

    // 6) snapshot：當下 Project 的 TAI 權重（如果有設定）
    let taiWeightSnapshot: Record<string, number> | null = null;
    if (response.project && response.project.taiOrders.length > 0) {
      taiWeightSnapshot = {};
      for (const item of response.project.taiOrders) {
        // 例如：{ ACCURACY: 0.2, RELIABILITY: 0.1, ... }
        taiWeightSnapshot[item.indicator] =
          item.weight ?? 0; // 如果沒有 weight 就先存 0
      }
    }
    
    console.log("Cleaned answers:", cleanedAnswers); // debug  
    console.log("TAI scores:", taiScores); // debug
    console.log("Overall score:", overallScore); // debug

    console.log("typeof overallScore:", typeof overallScore);
    console.log("instance:", overallScore);

    // 7) 建立 LLM prompt 並呼叫 LLM 產生分析
    const prompt = this.buildLLMPrompt(taiScores, overallScore);

    console.log("Building LLM prompt..."); // debug
    //console.log("LLM Prompt:", prompt); // debug

    const analysisText = await callLLM(prompt);

    // 8) upsert 進 Report table（以 responseId 為 unique）
    const modelUsed = "openai/gpt-4.1"; // 和 llm.ts 預設一致

    console.log("TAI Scores:", taiScores);
    console.log("Cleaned answers:", cleanedAnswers);
    console.log("Ready to UPSERT report for response =", responseId);

    const reportRecord = await prisma.report.upsert({

      where: { responseId },
      update: {
        overallScore,
        analysisText,
        radarData: taiScores,          // 這裡存 axis -> score (0–1) 的 map
        taiWeightSnapshot,
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
        taiWeightSnapshot,
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

    // 9) 回傳給 controller / 前端
    return {
      report: reportRecord, // DB 中的 Report（含 response 簡要資訊 + images）
      radarData,            // [{ axis, value }] 給前端畫圖用
      scores: taiScores,    // { ACCURACY: 0.8, ... } 0–1
      overallScore,
      analysisText,
    };
  }

  /**
   * 建立 LLM Prompt
   */
  buildLLMPrompt(scores: Record<string, number>, overallScore: number) {
    console.log("before loading prompt config");  // debug

    // 如果之後想把 prompt.json 的文字塞進來可以用這個物件
    let promptConfig = {};
    try {
      promptConfig = loadPromptConfig();
      console.log("PROMPT CONFIG LOADED:", promptConfig);
    } catch (err) {
      console.error("FAILED TO LOAD prompt.json:", err);
      promptConfig = {};   // fallback
    }
    console.log("PROMPT CONFIG LOADED:", promptConfig);
    
    const background = promptConfig?.background ?? "";

    return `
你是一位專業的可信任 AI（TAI）分析師。

${background}

以下是某次 AI 系統評估的結果（0–1）：

Overall Score:
${overallScore.toFixed(2)}

各面向分數（TAI 指標）：
${JSON.stringify(scores, null, 2)}

請基於這些資料，撰寫一份至少 150 字的專業分析，包含：

1. Overall Summary（整體表現）
2. Strengths（最高分的 1–2 個指標，說明為何表現良好）
3. Weaknesses / Risks（最低分的 1–2 個指標，指出風險或潛在問題）
4. Actionable Recommendations（至少 2–3 個具體可執行的改善建議）

請使用專業、清楚、具建設性的語氣。
    `;
  }
}

export const reportService = new ReportService();
