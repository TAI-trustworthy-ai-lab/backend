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
    // 1) 取得 Response + Answers + Project TAI 排序
    const response = await prisma.response.findUnique({
      where: { id: responseId },
      include: {
        answers: { include: { question: true, option: true } },
        project: {
          include: {
            // 既然 taiOrders 本身就有順序，我們直接讀取即可
            taiOrders: true, 
          },
        },
      },
    });

    if (!response) {
      throw new Error("Response not found");
    }

    // 2) 整理答案 -> { axis, value }
    const cleanedAnswers = response.answers.map((a) => {
      let score: number | null = null;

      if (a.value !== null && a.value !== undefined) {
        score = Number(a.value);
      } else if (a.option && a.option.value !== null && a.option.value !== undefined) {
        score = Number(a.option.value);
      }

      // -1 表示 N/A，回傳 null 讓後面過濾掉
      if (score === -1) score = -1; 
      if (score === null) return null; 

      return {
        axis: a.question.category,
        value: score, 
      };
    })  
    .filter((item): item is { axis: string; value: number } => item !== null);

    // 3) 計算各軸平均分數 (0–1, 或 -1 表示 N/A)
    const taiScores = computeTAIScores(cleanedAnswers);

    // 4) 轉成 radarData 給前端畫圖用
    const radarData = computeRadarData(taiScores);

    // ============================================================
    // 5) 準備權重 Snapshot & 計算 Overall Score (依照 taiOrders 順序配權重)
    // ============================================================
    
    const weightMap: Record<string, number> = {};
    const taiOrders = response.project?.taiOrders || [];
    let hasCustomWeights = false;

    if (taiOrders.length > 0) {
      hasCustomWeights = true;

      // 直接依據陣列的順序 (Index) 分配權重
      taiOrders.forEach((item, index) => {
        let assignedWeight = 0.04; // 預設給最後梯隊 (第 8~11 名)

        if (index < 4) {
            // 第 1 ~ 4 名 (Index 0, 1, 2, 3) -> 0.15
            assignedWeight = 0.15;
        } else if (index < 7) {
            // 第 5 ~ 7 名 (Index 4, 5, 6) -> 0.08
            assignedWeight = 0.08;
        } 
        // 第 8 名以後 (Index 7+) -> 0.04

        weightMap[item.indicator] = assignedWeight;
      });
    }

    // 開始計算加權平均
    let totalWeightedScore = 0;
    let totalValidWeight = 0;

    // 遍歷所有計算出來的軸分數
    for (const [axis, score] of Object.entries(taiScores)) {
        // 遇到 N/A (-1) 或 NaN，直接跳過 (不計入分子，也不計入分母)
        if (score === -1 || isNaN(score)) {
            continue;
        }

        // 決定該軸的權重
        let weight = 1; // 若無專案設定，預設權重為 1 (算術平均)
        
        if (hasCustomWeights) {
            // 如果該軸有在排序設定中，取出分配好的權重
            // 若該軸不在 taiOrders 裡 (異常狀況)，這裡視為 0 或給予最低權重
            weight = weightMap[axis] ?? 0; 
        }

        // 分子累加：分數 * 權重
        totalWeightedScore += (score * weight);
        // 分母累加：有效權重
        totalValidWeight += weight;
    }

    // 計算最終總分
    const overallScore = totalValidWeight > 0 
        ? totalWeightedScore / totalValidWeight 
        : 0;

    // 準備要存入 DB 的 Snapshot (這裡存的就是我們剛剛分配好的 0.15/0.08/0.04)
    const taiWeightSnapshot = hasCustomWeights ? weightMap : null;

    console.log("TAI scores:", taiScores); 
    console.log("Weight Map (Assigned by Order):", weightMap);
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
    
    const statusList = axisStatus.join('\n* ');
    
    return `
${background}

以下是本次評估的 11 個可信賴 AI 倫理指標的符合程度（由高至低）：

* ${statusList}

請根據您作為「可信任 AI 顧問」的角色，並依據 System Prompt 中要求的格式（改善建議段落 + Markdown 表格計畫），輸出分析報告。
    `;
  }
}

export const reportService = new ReportService();