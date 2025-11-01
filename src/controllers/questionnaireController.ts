// src/controllers/questionnaireController.ts
import { Request, Response } from 'express';
import * as questionnaireService from '../services/questionnaireService';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler';


export const createQuestionnaire = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const questionnaire = await questionnaireService.createQuestionnaire(data);
    return sendSuccessResponse(res, questionnaire);
  } catch (error) {
    console.error('Prisma Error in createQuestionnaire:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

export const getQuestionnaireById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const questionnaire = await questionnaireService.getQuestionnaireById(id);

    if (!questionnaire) return sendErrorResponse(res, 'Questionnaire not found', 404);
    return sendSuccessResponse(res, questionnaire);
  } catch (error) {
    return sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};
