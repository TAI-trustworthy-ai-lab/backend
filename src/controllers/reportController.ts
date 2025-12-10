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

    const payload = {
      ...result.report,
      overallScore: result.overallScore,
      analysisText: result.analysisText,
      radarData: result.report.radarData,
      questionStatsText: result.questionStatsText,
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
      sendErrorResponse(res, "Report not found for this response.", 404);
      return;
    }

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
