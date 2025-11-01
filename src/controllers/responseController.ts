// src/controllers/responseController.ts
import { Request, Response } from 'express';
import * as responseService from '../services/responseService';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler';

export const createResponse = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const responseRecord = await responseService.createResponse(data);
    return sendSuccessResponse(res, responseRecord);
  } catch (error) {
    return sendErrorResponse(res,error instanceof Error ? error.message : String(error));
  }
};

export const getResponsesByQuestionnaireId = async (req: Request, res: Response) => {
  try {
    const qid = parseInt(req.params.qid);
    const responses = await responseService.getResponsesByQuestionnaireId(qid);
    return sendSuccessResponse(res, responses);
  } catch (error) {
    return sendErrorResponse(res,error instanceof Error ? error.message : String(error));
  }
};
