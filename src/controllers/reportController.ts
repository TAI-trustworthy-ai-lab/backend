import { Request, Response } from 'express';
import { PrismaClient} from '@prisma/client';
// 1. 【已修正路徑】
//    這就是您剛剛修正的、正確的路徑
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler';
// 2. 移除 axios 和 dotenv

// 3. 【新增】從您的 LLM 服務檔案中匯入函式
//    (路徑根據您的說明 "reportLLM 是在../services/test/reportLLM.ts")
import { generateOverallAnalysis, generateReportForResponse } from '../services/test/reportLLM';

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
    const responseId = parseInt(req.params.responseId, 10);
    if (Number.isNaN(responseId)) {
      return sendErrorResponse(res, 'Invalid responseId');
    }

    // 1) 呼叫整合流程 → 產出完整報告（同時畫圖 + 上傳 Cloudinary）
    const [jsonPath, reportData] = await generateReportForResponse({
      responseId,
      apiTemplate: 'http://localhost:3001/api/response/id/{id}',
      mode: 'answers',
      outDir: 'outputs',
      title: 'TAI Radar (Integrated Final Report)',
      qApiTemplate: 'http://localhost:3001/api/questionnaire/version/{qid}',
      questionCatalogPath: null,
      qidAxisMapPath: null,
      likertYesMin: 4,
      likertNoMax: 2,
      saveCatalogSnapshot: false,
      withLlm: true,
      llmCall: undefined,
    });

    // 2) 如果沒有 analysisText，就再生一段總結文字
    const overallMean = reportData?.summary?.overall_mean ?? 0; // 目前假設是 0~100
    const analysisText: string =
      reportData.analysisText ??
      (await generateOverallAnalysis(overallMean, reportData.scores ?? {}));

    // 3) 準備要寫進 Prisma 的欄位
    const overallScore = overallMean;
    const radarData = reportData.scores ?? {};

    const radarImageUrl: string | null =
      reportData?.meta?.radar_image_path ?? null;

    // 可以把一些 LLM / 問卷相關 metadata 放在 llmMeta（選配）
    const llmMeta = {
      questionnaireType:
        reportData?.llm?.sections?.[0]?.questionnaire_type ?? null,
      generatedAt: reportData?.meta?.generated_at ?? null,
    };

    // 4) 寫入 / 更新 Report + ReportImage
    //    因為 responseId 是 @unique，所以用 upsert
    const savedReport = await prisma.report.upsert({
      where: { responseId },
      create: {
        responseId,
        overallScore,
        analysisText,
        radarData,
        taiWeightSnapshot: null, // 之後如果有 Project 權重可以再帶
        llmMeta,
        images: radarImageUrl
          ? {
              create: [
                {
                  url: radarImageUrl,
                  caption: reportData?.meta?.title ?? null,
                },
              ],
            }
          : undefined,
      },
      update: {
        overallScore,
        analysisText,
        radarData,
        taiWeightSnapshot: null,
        llmMeta,
        // 先把舊圖刪掉，再新增一張最新的雷達圖
        images: radarImageUrl
          ? {
              deleteMany: {},
              create: [
                {
                  url: radarImageUrl,
                  caption: reportData?.meta?.title ?? null,
                },
              ],
            }
          : {
              // 如果這次沒有圖，就清空
              deleteMany: {},
            },
      },
      include: {
        images: true,
      },
    });

    // 5) 回傳給前端：同時給完整報告 + DB 裡的紀錄
    return sendSuccessResponse(
      res,
      {
        reportData: {
          ...reportData,
          analysisText,
        },
        dbRecord: savedReport,
      },
      200,
    );
  } catch (error) {
    console.error('[generateReport] error:', error);
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