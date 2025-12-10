// src/controllers/responseController.ts
import { Request, Response } from 'express';
import * as responseService from '../services/responseService';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler';

/**
 * user submits a questionnaire response
 */
export const createResponse = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const responseRecord = await responseService.createResponse(data);
    sendSuccessResponse(res, responseRecord, 201);
  } catch (error: any) {
    if (error.validationErrors && Array.isArray(error.validationErrors)) {
      res.status(400).json({
        success: false,
        message: '部分題目驗證未通過',
        errors: error.validationErrors,
      });
      return;
    }

    sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * get all responses for a version
 */
export const getResponsesByVersionId = async (req: Request, res: Response): Promise<void> => {
  try {
    const vid = parseInt(req.params.vid, 10);
    const responses = await responseService.getResponsesByVersionId(vid);
    sendSuccessResponse(res, responses);
  } catch (error) {
    sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * get single response by ID
 */
export const getResponseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const responseRecord = await responseService.getResponseById(id);

    if (!responseRecord) {
      res.status(404).json({
        success: false,
        message: 'Response not found',
      });
      return;
    }

    sendSuccessResponse(res, responseRecord);
  } catch (error) {
    sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * get responses by user
 */
export const getResponsesByUserId = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const responses = await responseService.getResponsesByUserId(userId);
    sendSuccessResponse(res, responses);
  } catch (error) {
    sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * get responses by project
 */
export const getResponsesByProjectId = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const responses = await responseService.getResponsesByProjectId(projectId);
    sendSuccessResponse(res, responses);
  } catch (error) {
    sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * update an existing response
 */
export const updateResponse = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({
        success: false,
        message: 'answers 陣列不可為空',
      });
      return;
    }

    const updated = await responseService.updateResponse(id, answers);
    sendSuccessResponse(res, updated);
  } catch (error) {
    sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * delete a response
 */
export const deleteResponse = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await responseService.deleteResponse(id);
    sendSuccessResponse(res, deleted);
  } catch (error) {
    sendErrorResponse(
      res,
      error instanceof Error ? error.message : String(error)
    );
  }
};
