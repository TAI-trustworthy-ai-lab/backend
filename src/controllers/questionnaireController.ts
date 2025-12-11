// src/controllers/questionnaireController.ts
import { Request, Response } from 'express';
import * as questionnaireService from '../services/questionnaireService';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler';

// Create questionnaire
export const createQuestionnaire = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const questionnaire = await questionnaireService.createQuestionnaire(data);
    sendSuccessResponse(res, questionnaire);
  } catch (error) {
    console.error('Prisma Error in createQuestionnaire:', error);
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

// Get questionnaire by ID (legacy path)
export const getQuestionnaireById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const questionnaire = await questionnaireService.getQuestionnaireVersionById(id);

    if (!questionnaire) {
      sendErrorResponse(res, 'Questionnaire not found', 404);
      return;
    }

    sendSuccessResponse(res, questionnaire);
  } catch (error) {
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

// Get latest group questionnaire versions
export const getLatestQuestionnaireGroups = async (req: Request, res: Response): Promise<void> => {
  try {
    const groups = await questionnaireService.getLatestQuestionnaireGroups();
    sendSuccessResponse(res, groups);
  } catch (error) {
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

// Get questionnaire version by versionId
export const getQuestionnaireVersionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const questionnaire = await questionnaireService.getQuestionnaireVersionById(id);

    if (!questionnaire) {
      sendErrorResponse(res, 'Questionnaire version not found', 404);
      return;
    }

    sendSuccessResponse(res, questionnaire);
  } catch (error) {
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

// Get all questionnaires
export const getAllQuestionnaires = async (req: Request, res: Response): Promise<void> => {
  try {
    const { groupName, isActive, includeQuestions, page, pageSize } = req.query as Record<string, string | undefined>;

    const data = await questionnaireService.getAllQuestionnaireVersions({
      groupName,
      isActive: isActive ? isActive === "true" : undefined,
      includeQuestions: includeQuestions ? includeQuestions === "true" : true,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20
    });

    sendSuccessResponse(res, data);
  } catch (error) {
    console.error('Prisma Error in getAllQuestionnaires:', error);
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

// Get latest questionnaire by group
export const getLatestQuestionnaireByGroupName = async (req: Request, res: Response): Promise<void> => {
  try {
    const groupName = req.query.groupName as string;

    if (!groupName) {
      sendErrorResponse(res, 'Missing groupName parameter', 400);
      return;
    }

    const data = await questionnaireService.getLatestQuestionnaireByGroupName(groupName);
    sendSuccessResponse(res, data);
  } catch (error) {
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

// PATCH: Update questionnaire version
export const updateQuestionnaire = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, description, isActive } = req.body;

    const updated = await questionnaireService.updateQuestionnaireById(id, {
      title,
      description,
      isActive,
    });

    sendSuccessResponse(res, updated);
  } catch (error) {
    console.error('Prisma Error in updateQuestionnaire:', error);
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

// DELETE: Remove questionnaire version
export const deleteQuestionnaire = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await questionnaireService.deleteQuestionnaireById(id);

    sendSuccessResponse(res, {
      message: `Questionnaire version ${id} deleted successfully`,
      deleted,
    });
  } catch (error) {
    console.error('Prisma Error in deleteQuestionnaire:', error);
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

// Duplicate questionnaire version
export const duplicateQuestionnaire = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, description } = req.body;

    const duplicated = await questionnaireService.duplicateQuestionnaireById(id, { title, description });
    sendSuccessResponse(res, duplicated);
  } catch (error) {
    console.error('Prisma Error in duplicateQuestionnaire:', error);
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};
