import { Request, Response } from 'express';
import * as projectService from '../services/projectService';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler';

/**
 * 建立新 Project
 */
export const createProject = async (req: Request, res: Response) => {
  try {
    const project = await projectService.createProject(req.body);
    return sendSuccessResponse(res, project, 201);
  } catch (error) {
    return sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

/**
 * 查某使用者的所有 Project
 */
export const getProjectsByUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const projects = await projectService.getProjectsByUser(userId);
    return sendSuccessResponse(res, projects);
  } catch (error) {
    return sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

/**
 * 查單一 Project
 */
export const getProjectById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const project = await projectService.getProjectById(id);
    return sendSuccessResponse(res, project);
  } catch (error) {
    return sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

export const getProjectByName = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const name = decodeURIComponent(req.params.name);
    const project = await projectService.getProjectByName(userId, name);
    return sendSuccessResponse(res, project);
  } catch (error) {
    return sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

/**
 * 查 Project 的 TAI 排序
 */
export const getProjectTAI = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const taiOrder = await projectService.getProjectTAI(id);
    return sendSuccessResponse(res, taiOrder);
  } catch (error) {
    return sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

/**
 * 更新 Project 的 TAI 排序
 */
export const updateProjectTAI = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { priorities } = req.body; // 也支援直接傳 array
    const taiData = Array.isArray(req.body) ? req.body : priorities;
    const result = await projectService.updateProjectTAI(id, taiData);
    return sendSuccessResponse(res, result);
  } catch (error) {
    return sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = await projectService.deleteProject(id);
    return sendSuccessResponse(res, result);
  } catch (error) {
    return sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

