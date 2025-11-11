// src/controllers/questionnaireController.ts
import { Request, Response } from 'express';
import * as questionnaireService from '../services/questionnaireService';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler';

// 建立新問卷版本 (管理端 / seeding 用)
export const createQuestionnaire = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const questionnaire = await questionnaireService.createQuestionnaire(data);
    return sendSuccessResponse(res, questionnaire);
  } catch (error) {
    console.error('Prisma Error in createQuestionnaire:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
};

// get one questionnaire by its ID
// /api/questionnaire/:id = 取得某版本
export const getQuestionnaireById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const questionnaire = await questionnaireService.getQuestionnaireVersionById(id);

    if (!questionnaire)
      return sendErrorResponse(res, 'Questionnaire not found', 404);
    return sendSuccessResponse(res, questionnaire);
  } catch (error) {
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
};

// get all questionnaire groups with their latest version
// 取得所有 Group + 各自最新版本
export const getLatestQuestionnaireGroups = async (req: Request, res: Response) => {
  try {
    const groups = await questionnaireService.getLatestQuestionnaireGroups();
    return sendSuccessResponse(res, groups);
  } catch (error) {
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
};

// use version id to get questionnaire content
// 明確用 version id 取得問卷內容
export const getQuestionnaireVersionById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const questionnaire = await questionnaireService.getQuestionnaireVersionById(id);

    if (!questionnaire)
      return sendErrorResponse(res, 'Questionnaire version not found', 404);
    return sendSuccessResponse(res, questionnaire);
  } catch (error) {
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
};
