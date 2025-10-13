import { Request, Response, NextFunction } from 'express';
import { hashPassword, comparePasswords } from '../utils/bcryptHandler';
import HttpStatusCode from '../utils/HttpStatusCode';
import { sendSuccessResponse, sendErrorResponse, sendNotFoundResponse, sendSuccessNoDataResponse } from '../utils/responseHandler';
import { UserService } from '../services/userService';
import { CreateUserRequest, UserResponse } from '@src/types/userTypes';
import { generateToken } from '../utils/jwtHandler';
import { userSchema } from '../types/zod';

export const createUserController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password }: CreateUserRequest = req.body;
    const existingUserByName = await UserService.findUserByName(name);
    if (existingUserByName) {
      sendErrorResponse(res, 'User with this name already exists', HttpStatusCode.CONFLICT);
      return;
    }

    const existingUserByEmail = await UserService.findUserByEmail(email);
    if (existingUserByEmail) {
      sendErrorResponse(res, 'User with this email already exists', HttpStatusCode.CONFLICT);
      return;
    }

    const hashedPassword = await hashPassword(password);
    const newUser = await UserService.createUser({ name, email, hashedPassword });

    const userResponse: UserResponse = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };

    sendSuccessResponse(res, userResponse, HttpStatusCode.CREATED);
  } catch (error) {
    console.error('[createUserController] Error:', error);
    sendErrorResponse(res, 'Internal server error', HttpStatusCode.INTERNAL_SERVER_ERROR);
  }
};

export const deleteUserController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await UserService.findUserById(Number(id));
    if (!user) {
      sendNotFoundResponse(res, 'User not found');
      return;
    }

    await UserService.deleteUser(Number(id));
    sendSuccessResponse(res, 'User deleted successfully', HttpStatusCode.OK);
  } catch (error) {
    console.error('[deleteUserController] Error:', error);
    sendErrorResponse(res, 'Internal server error', HttpStatusCode.INTERNAL_SERVER_ERROR);
  }
};

export const findAllUsersController = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await UserService.findAllUsers();

    const usersResponse: UserResponse[] = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    sendSuccessResponse(res, usersResponse, HttpStatusCode.OK);
  } catch (error) {
    console.error('[findAllUsersController] Error:', error);
    sendErrorResponse(res, 'Internal server error', HttpStatusCode.INTERNAL_SERVER_ERROR);
  }
};

export const findUserByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await UserService.findUserById(Number(id));
    if (!user) {
      sendNotFoundResponse(res, 'User not found');
      return;
    }

    const userResponse: UserResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    sendSuccessResponse(res, userResponse, HttpStatusCode.OK);
  } catch (error) {
    console.error('[findUserByIdController] Error:', error);
    sendErrorResponse(res, 'Internal server error', HttpStatusCode.INTERNAL_SERVER_ERROR);
  }
};

export const findUserByEmailController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.params;

    const user = await UserService.findUserByEmail(email);
    if (!user) {
      sendNotFoundResponse(res, 'User not found');
      return;
    }

    const userResponse: UserResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    sendSuccessResponse(res, userResponse, HttpStatusCode.OK);
  } catch (error) {
    console.error('[findUserByEmailController] Error:', error);
    sendErrorResponse(res, 'Internal server error', HttpStatusCode.INTERNAL_SERVER_ERROR);
  }
};

export const updateUserController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const user = await UserService.findUserById(Number(id));
    if (!user) {
      sendNotFoundResponse(res, 'User not found');
      return;
    }

    await UserService.updateUser(Number(id), { name });
    sendSuccessResponse(res, 'User updated successfully', HttpStatusCode.OK);
  } catch (error) {
    console.error('[updateUserController] Error:', error);
    sendErrorResponse(res, 'Internal server error', HttpStatusCode.INTERNAL_SERVER_ERROR);
  }
};

export const loginUserController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      sendErrorResponse(res, 'Email and password are required', HttpStatusCode.BAD_REQUEST);
      return;
    }

    const user = await UserService.findUserByEmail(email);
    if (!user) {
      sendNotFoundResponse(res, 'User not found');
      return;
    }

    const isPasswordValid = await comparePasswords(password, user.hashedPassword);
    if (!isPasswordValid) {
      sendErrorResponse(res, 'Invalid credentials', HttpStatusCode.UNAUTHORIZED);
      return;
    }

    const token = generateToken({ id: user.id.toString() }, '1h');
    sendSuccessResponse(res, { token }, HttpStatusCode.OK);
  } catch (error) {
    console.error('[loginUserController] Error:', error);
    sendErrorResponse(res, 'Internal server error', HttpStatusCode.INTERNAL_SERVER_ERROR);
  }
};

export const logoutUserController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.cookie('jwt', '', {
      httpOnly: true,
      expires: new Date(0),
    });

    sendSuccessNoDataResponse(res, 'Logout Successful');
  } catch (error) {
    next(error);
  }
};

export const validateLoginData = (request: Request, response: Response, next: NextFunction): void => {
  try {
    const data = request.body;
    userSchema.parse(data);
    next();
  } catch (error) {
    next(error);
  }
};
