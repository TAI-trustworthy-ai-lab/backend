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

// GET /api/questionnaire/all
export const getAllQuestionnaires = async (req: Request, res: Response) => {
  try {
    const {
      groupName,
      isActive,
      includeQuestions,
      page,
      pageSize,
    } = req.query as Record<string, string | undefined>;

    const data = await questionnaireService.getAllQuestionnaireVersions({
      groupName: groupName,
      isActive: typeof isActive === 'string' ? isActive === 'true' : undefined,
      includeQuestions:
        typeof includeQuestions === 'string' ? includeQuestions === 'true' : true,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });

    return sendSuccessResponse(res, data);
  } catch (error) {
    console.error('Prisma Error in getAllQuestionnaires:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
};

// PATCH /api/questionnaire/:id
export const updateQuestionnaire = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, isActive } = req.body;
    const updated = await questionnaireService.updateQuestionnaireById(id, {
      title,
      description,
      isActive,
    });
    return sendSuccessResponse(res, updated);
  } catch (error) {
    console.error('Prisma Error in updateQuestionnaire:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
};

// DELETE /api/questionnaire/:id
export const deleteQuestionnaire = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await questionnaireService.deleteQuestionnaireById(id);
    return sendSuccessResponse(res, {
      message: `Questionnaire version ${id} deleted successfully`,
      deleted,
    });
  } catch (error) {
    console.error('Prisma Error in deleteQuestionnaire:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
};

// PUT /api/questionnaire/:id/duplicate
export const duplicateQuestionnaire = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description } = req.body;
    const duplicated = await questionnaireService.duplicateQuestionnaireById(id, {
      title,
      description,
    });
    return sendSuccessResponse(res, duplicated);
  } catch (error) {
    console.error('Prisma Error in duplicateQuestionnaire:', error);
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error),
    );
  }
};

