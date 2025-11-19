import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler';
// 如果未接 OpenAI API，可以先 mock
// import OpenAI from 'openai';

const prisma = new PrismaClient();

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
            question: { select: { category: true } },
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
      if (ans.value !== null && ans.value !== undefined && ans.question.category) {
        const cat = ans.question.category;
        if (!categoryScores[cat]) categoryScores[cat] = [];
        categoryScores[cat].push(ans.value);
      }
    }

    const radarData: Record<string, number> = {};
    let totalSum = 0;
    let totalCount = 0;

    for (const [category, values] of Object.entries(categoryScores)) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      radarData[category] = parseFloat(avg.toFixed(2));
      totalSum += avg;
      totalCount++;
    }

    const overallScore = totalCount > 0 ? parseFloat((totalSum / totalCount).toFixed(2)) : 0;

    // 模擬分析文字（未接LLM）
    // 請内容與LLM分析組再做更改
    const analysisText = `本次 AI 系統整體評分為 ${overallScore}，其中表現最佳的面向為 ${
      Object.entries(radarData).sort((a, b) => b[1] - a[1])[0][0]
    }，建議後續可加強 ${Object.entries(radarData).sort((a, b) => a[1] - b[1])[0][0]} 面向。`;

    // 寫入 Report
    const report = await prisma.report.create({
      data: {
        responseId,
        overallScore,
        radarData,
        analysisText,
      },
    });

    return sendSuccessResponse(res, report, 201);
  } catch (error) {
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
            project: { select: { id: true, name: true } },
            version: { select: { id: true, title: true } },
          },
        },
        images: true,
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
};

// controllers/reportController.ts

export const addReportImage = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.reportId);
    const { url, caption } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Image URL is required",
      });
    }

    // 檢查 Report 是否存在
    const reportExists = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!reportExists) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    const newImage = await prisma.reportImage.create({
      data: {
        reportId,
        url,
        caption,
      },
    });

    return sendSuccessResponse(res, newImage, 201);

  } catch (error) {
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error)
    );
  }
};

