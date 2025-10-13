import { Prisma } from '@prisma/client';
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { JsonWebTokenError } from 'jsonwebtoken';
import { sendBadRequestResponse, sendErrorResponse, sendValidationError } from '../utils/responseHandler';

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (error instanceof z.ZodError) {
    const errors = error.errors.map((e) => e.message);
    sendValidationError(response, 'Validation Error', errors);
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    sendBadRequestResponse(response, 'Database error occurred');
    return;
  }

  if (error instanceof JsonWebTokenError) {
    sendBadRequestResponse(response, 'Invalid token');
    return;
  }

  sendErrorResponse(response, 'Internal Server Error');
};
