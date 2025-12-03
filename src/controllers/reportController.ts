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

    sendSuccessResponse(res, result, 201);
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

    sendSuccessResponse(res, report);
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
