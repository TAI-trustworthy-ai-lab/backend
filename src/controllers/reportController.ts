// src/controllers/reportController.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler";
import { reportService } from "../services/reportService";

const prisma = new PrismaClient();

/**
 * Generate a report from a responseId
 */
export const generateReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const responseId = Number(req.params.responseId);

    if (isNaN(responseId)) {
      sendErrorResponse(res, "Invalid responseId", 400);
      return;
    }

    const result = await reportService.generateReport(responseId);
    // ⭐ 將回傳形狀「攤平」成原本前端習慣用的 Report 形狀 + 新增 questionStatsText
    const payload = {
      ...result.report,          // id, responseId, overallScore, generatedAt, radarData, taiWeightSnapshot, llmMeta, response, images
      overallScore: result.overallScore, // 保險起見，用最新計算的
      analysisText: result.analysisText, // 也是用最新 LLM 內容
      radarData: result.report.radarData, // DB 內已是最新 taiScores（0~1 或 -1）
      questionStatsText: result.questionStatsText, // ⭐ 新增的統計文字
    };

    sendSuccessResponse(res, payload, 201);
  } catch (error: any) {
    sendErrorResponse(res, error.message);
  }
};

/**
 * Get a report previously generated
 */
export const getReportByResponseId = async (req: Request, res: Response): Promise<void> => {
  try {
    const responseId = Number(req.params.responseId);

    if (isNaN(responseId)) {
      sendErrorResponse(res, "Invalid responseId", 400);
      return;
    }

    // 1) 先嘗試從資料庫找到已經存在的 report
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
      res.status(404).json({
        success: false,
        message: "Report not found for this response.",
      });
      return;
    }

    // 2) 有現成的 report：不再呼叫 LLM，只需要計算 questionStatsText 給前端
    const responseEntity = await prisma.response.findUnique({
      where: { id: responseId },
      include: {
        answers: { include: { question: true, option: true } },
      },
    });

    let questionStatsText: Record<string, string> = {};

    if (responseEntity) {
      questionStatsText = reportService.buildQuestionStatsFromResponse(responseEntity);
    }

    const payload = {
      ...report,
      questionStatsText,
    };

    sendSuccessResponse(res, payload);
  } catch (error: any) {
    sendErrorResponse(res, error.message);
  }
};


/**
 * Add an image to a report
 */
export const addReportImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const reportId = Number(req.params.reportId);
    const { url, caption } = req.body;

    if (!url) {
      sendErrorResponse(res, "Image URL is required", 400);
      return;
    }

    const reportExists = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!reportExists) {
      sendErrorResponse(res, "Report not found", 404);
      return;
    }

    const newImage = await prisma.reportImage.create({
      data: {
        reportId,
        url,
        caption,
      },
    });

    sendSuccessResponse(res, newImage, 201);
  } catch (error: any) {
    sendErrorResponse(res, error.message);
  }
};
