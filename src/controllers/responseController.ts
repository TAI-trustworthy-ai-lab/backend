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

/**
 * get a single response (with answers + question details)
 * 取得單筆完整作答，含題目資訊（user/project/version/answers）
 * path param: :id
 */
export const getResponseById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const responseRecord = await responseService.getResponseById(id);

    if (!responseRecord) {
      return res.status(404).json({
        success: false,
        message: 'Response not found',
      });
    }

    return sendSuccessResponse(res, responseRecord);
  } catch (error) {
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
};

/**
 * get all responses for a specific user
 * 取得指定使用者的所有作答
 * path param: :userId
 */
export const getResponsesByUserId = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const responses = await responseService.getResponsesByUserId(userId);
    return sendSuccessResponse(res, responses);
  } catch (error) {
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * get all responses for a specific project
 * 取得指定專案的所有作答
 * path param: :projectId
 */
export const getResponsesByProjectId = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const responses = await responseService.getResponsesByProjectId(projectId);
    return sendSuccessResponse(res, responses);
  } catch (error) {
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * update an existing response (update answers)
 * 更新作答的內容
 * path param: :id
 * body: {
 *   answers: [
 *     { questionId, value? , textValue?, optionId?, optionIds? }
 *   ]
 * }
 *
 * 說明：
 * - SCALE          問題：用 value
 * - SINGLE_CHOICE  問題：用 optionId
 * - MULTIPLE_CHOICE問題：用 optionIds (number[])，代表目前勾選的全部選項
 * - TEXT           問題：用 textValue
 */
export const updateResponse = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'answers 陣列不可為空',
      });
    }

    const updated = await responseService.updateResponse(id, answers);
    return sendSuccessResponse(res, updated);
  } catch (error) {
    
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * delete a response by ID
 * 刪除一份作答
 * path param: :id
 */
export const deleteResponse = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await responseService.deleteResponse(id);
    return sendSuccessResponse(res, deleted);
  } catch (error) {
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error)
    );
  }
};
