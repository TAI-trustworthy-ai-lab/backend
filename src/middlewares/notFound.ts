import { Request, Response } from 'express';
import { sendNotFoundResponse } from '../utils/responseHandler';

export const notFoundHandler = (request: Request, response: Response): void => {
  console.warn(`Route not found: ${request.method} ${request.originalUrl}`);
  const notFoundMessage = {
    Requested_URL: request.originalUrl,
    success: false,
    error: 'Error 404 - Not Found',
  };
  sendNotFoundResponse(response, notFoundMessage);
};
