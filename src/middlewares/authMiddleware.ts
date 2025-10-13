import { UserService } from '../services/userService';
import { NextFunction, Request, Response } from 'express';
import { sendUnauthorizedResponse } from '../utils/responseHandler';
import { verifyToken } from '../utils/jwtHandler';
import { UserRole } from '@prisma/client';

const protectAuth = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : request.cookies.jwt;

    if (!token) {
      console.warn('No JWT token provided');
      sendUnauthorizedResponse(response, 'Unauthorized - you need to login');
      return;
    }

    const decoded = verifyToken(token);
    const authUser = await UserService.findUserById(Number(decoded.id));
    if (!authUser) {
      console.warn('User not found for provided token');
      sendUnauthorizedResponse(response, 'Unauthorized - invalid user');
      return;
    }

    (request as any).user = authUser;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    sendUnauthorizedResponse(response, 'Unauthorized - invalid token');
    return;
  }
};

const protectAdmin = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
  try {
    const token = request.cookies.jwt;
    if (!token) {
      sendUnauthorizedResponse(response, 'Unauthorized - you need to login');
      return;
    }

    const decoded = verifyToken(token);
    const authUser = await UserService.findUserById(Number(decoded.id));
    if (!authUser || authUser.role !== UserRole.ADMIN) {
      sendUnauthorizedResponse(response, 'Unauthorized - admin access required');
      return;
    }

    request.user = authUser;
    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    sendUnauthorizedResponse(response, 'Unauthorized - invalid token');
    return;
  }
};

export { protectAuth, protectAdmin };
