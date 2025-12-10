import { Request, Response } from 'express';
import * as projectService from '../services/projectService';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler';

/**
 * 建立新 Project
 */
export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await projectService.createProject(req.body);
    sendSuccessResponse(res, project, 201);
  } catch (error) {
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

/**
 * 查某使用者的所有 Project
 */
export const getProjectsByUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const projects = await projectService.getProjectsByUser(userId);
    sendSuccessResponse(res, projects);
  } catch (error) {
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

/**
 * 查單一 Project
 */
export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const project = await projectService.getProjectById(id);
    sendSuccessResponse(res, project);
  } catch (error) {
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

/*
 * 查單一 Project 透過名稱
 */
export const getProjectByName = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const name = decodeURIComponent(req.params.name);
    const project = await projectService.getProjectByName(userId, name);
    sendSuccessResponse(res, project);
  } catch (error) {
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

/**
 * 查 Project 的 TAI 排序
 */
export const getProjectTAI = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const taiOrder = await projectService.getProjectTAI(id);
    sendSuccessResponse(res, taiOrder);
  } catch (error) {
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

/**
 * 更新 Project 的 TAI 排序
 */
export const updateProjectTAI = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { priorities } = req.body;
    const taiData = Array.isArray(req.body) ? req.body : priorities;
    const result = await projectService.updateProjectTAI(id, taiData);
    sendSuccessResponse(res, result);
  } catch (error) {
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

/**
 * 刪除 Project
 */
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await projectService.deleteProject(id);
    sendSuccessResponse(res, result);
  } catch (error) {
    sendErrorResponse(res, error instanceof Error ? error.message : String(error));
  }
};

