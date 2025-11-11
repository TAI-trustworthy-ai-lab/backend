// src/controllers/responseController.ts
import { Request, Response } from 'express';
import * as responseService from '../services/responseService';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler';

/**
 * user submits a questionnaire response (for a specific version)
 * 使用者提交問卷回覆（針對特定版本）
 * body: { userId, projectId, versionId, answers: [{ questionId, optionId, value, textValue }] }
 */
export const createResponse = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const responseRecord = await responseService.createResponse(data);
    return sendSuccessResponse(res, responseRecord, 201);
  } catch (error: any) {
    // check for validation errors from service
    // 檢查錯誤訊息中是否含有 "VALIDATION_ERRORS" 標記（由 service 傳出）
    if (error.validationErrors && Array.isArray(error.validationErrors)) {
      // handle multiple validation errors
      // 有多題錯誤：回傳陣列格式，前端可以直接對應顯示
      return res.status(400).json({
        success: false,
        message: '部分題目驗證未通過',
        errors: error.validationErrors,
      });
    }

    // normal error handling
    // 一般 Prisma / 系統錯誤
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
};

/**
 * get all responses for a specific questionnaire version
 * 取得某個版本問卷的所有回覆（管理端用）
 * path param: :vid
 */
export const getResponsesByVersionId = async (req: Request, res: Response) => {
  try {
    const vid = parseInt(req.params.vid);
    const responses = await responseService.getResponsesByVersionId(vid);
    return sendSuccessResponse(res, responses);
  } catch (error) {
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
};
