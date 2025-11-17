import { Request, Response } from 'express';
import { PrismaClient} from '@prisma/client';
// 1. 【已修正路徑】
//    這就是您剛剛修正的、正確的路徑
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler';
// 2. 移除 axios 和 dotenv

// 3. 【新增】從您的 LLM 服務檔案中匯入函式
//    (路徑根據您的說明 "reportLLM 是在../services/test/reportLLM.ts")
import { generateOverallAnalysis } from '../services/test/reportLLM';

const prisma = new PrismaClient();

// 4. 【已刪除】
//    整個 getLLMAnalysis 函式 (原 20-77 行) 已被移除。

/**
 * generate a report for a specific response
 * 根據作答內容生成報告（radarData + overallScore + analysisText）
 * path param: :responseId
 */
export const generateReport = async (req: Request, res: Response) => {
  try {
    const responseId = parseInt(req.params.responseId);

    // 取得作答內容與對應問題
    const responseRecord = await prisma.response.findUnique({
      where: { id: responseId },
      include: {
        answers: {
          include: {
            question: { select: { category: true } }, // 取得問題的 TAI 分類
          },
        },
      },
    });

    if (!responseRecord) {
      return res.status(404).json({ success: false, message: 'Response not found' });
    }

    // 計算各 TAI 指標平均分數
    const categoryScores: Record<string, number[]> = {};
    for (const ans of responseRecord.answers) {
      if (ans.value && ans.question.category) {
        const cat = ans.question.category;
        if (!categoryScores[cat]) categoryScores[cat] = [];
        categoryScores[cat].push(ans.value); // 收集同一分類的所有分數
      }
    }

    // 計算雷達圖資料 (Radar Data) 和總分 (Overall Score)
    const radarData: Record<string, number> = {};
    let totalSum = 0;
    let totalCount = 0;
    for (const [category, values] of Object.entries(categoryScores)) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      radarData[category] = parseFloat(avg.toFixed(2)); // 這裡的分數是 0.0 - 1.0
      totalSum += avg;
      totalCount++;
    }

    // 處理沒有答案的情況 (避免 NaN)
    const overallScore = totalCount > 0 ? parseFloat((totalSum / totalCount).toFixed(2)) : 0; // 0.0 - 1.0
    
    // 7. 【關鍵修改：呼叫 reportLLM.ts】
    
    let analysisText: string;
    
    // 這是 LLM 呼叫失敗時的安全備案 (Fallback)
    const fallbackText = `本次 AI 系統整體評分為 ${overallScore}，其中表現最佳的面向為 ${
        Object.keys(radarData).length > 0 ? Object.entries(radarData).sort((a, b) => b[1] - a[1])[0][0] : 'N/A'
      }，建議後續可加強 ${
        Object.keys(radarData).length > 0 ? Object.entries(radarData).sort((a, b) => a[1] - b[1])[0][0] : 'N/A'
      } 面向。`;

    try {
      // 7.1. 【修改】將 0-1.0 的分數轉換為 0-100
      const radarData100 = Object.fromEntries(
        Object.entries(radarData).map(([key, value]) => [key, value * 100])
      );
      const overallScore100 = overallScore * 100;

      // 7.2. 【修改】呼叫匯入的函式
      //      注意：reportLLM.ts 的函式參數順序是 (overallScore, radarData)
      analysisText = await generateOverallAnalysis(overallScore100, radarData100);

    } catch (llmError) {
      // 確保在 LLM 失敗時，詳細的錯誤資訊會被輸出到 Docker logs
      console.error("LLM_CALL_FAILED_DETAIL:", llmError instanceof Error ? llmError.message : String(llmError)); 
      
      // 如果 LLM 失敗（例如 API Key 錯誤、網路問題），
      // 則使用您原本的「模擬文字」作為安全備案 (Fallback)
      console.warn("LLM 分析失敗，將使用本地模擬文字。");
      analysisText = fallbackText;
    }

    // 8. 寫入 Report (使用 LLM 產生的或模擬的 analysisText)
    const report = await prisma.report.create({
      data: {
        responseId,
        overallScore, // 存入資料庫的仍是 0-1.0
        radarData, // Prisma 會自動處理 JSON (0-1.0)
        analysisText,
      },
    });

    // 回傳成功的回應
    return sendSuccessResponse(res, report, 201);
  } catch (error) {
    // 回傳錯誤的回應
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
};

/**
 * get report by responseId
 * 取得指定作答的報告
 * path param: :responseId
 */
export const getReportByResponseId = async (req: Request, res: Response) => {
  try {
    const responseId = parseInt(req.params.responseId);

    const report = await prisma.report.findUnique({
      where: { responseId },
      include: {
        response: {
          select: {
            id: true,
            user: { select: { id: true, name: true } },
            // 根據您在第 78 則的 schema.prisma，
            // Response 模型上沒有 project 或 version，
            // 因此我將這兩行註解掉，以避免潛在錯誤。
            project: { select: { id: true, name: true } },
            version: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found for this response.',
      });
    }

    return sendSuccessResponse(res, report);
  } catch (error) {
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
}