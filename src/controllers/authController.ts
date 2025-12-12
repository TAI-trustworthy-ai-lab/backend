import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

import { hashPassword, comparePasswords } from "../utils/bcryptHandler";
import { generateToken } from "../utils/jwtHandler";

import {
  sendSuccessResponse,
  sendErrorResponse,
  sendNotFoundResponse,
} from "../utils/responseHandler";

const prisma = new PrismaClient();

/**
 * Register
 * - 無 Email 驗證
 * - 註冊即視為已驗證
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      sendErrorResponse(res, "name、email、password 為必填", 400);
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    // 已存在且已驗證 → 不能重複註冊
    if (existing && existing.emailVerified) {
      sendErrorResponse(res, "此 Email 已被註冊", 400);
      return;
    }

    let user;

    if (!existing) {
      const hashed = await hashPassword(password);

      user = await prisma.user.create({
        data: {
          name,
          email,
          hashedPassword: hashed,
          emailVerified: true,  
          verifyToken: null,
          verifyTokenExp: null,
        },
      });
    } else {
      // 已存在但未驗證 → 直接補驗證
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          emailVerified: true,
          verifyToken: null,
          verifyTokenExp: null,
        },
      });
    }

    sendSuccessResponse(res, "註冊成功");
  } catch (err) {
    console.error("[register] Error:", err);
    sendErrorResponse(res, "註冊失敗", 500);
  }
};

/**
 * Login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      sendErrorResponse(res, "Email 和 password 都是必填", 400);
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      sendNotFoundResponse(res, "查無此使用者");
      return;
    }

    // 理論上永遠為 true，但保留防呆
    if (!user.emailVerified) {
      sendErrorResponse(res, "帳號尚未啟用", 403);
      return;
    }

    const isValid = await comparePasswords(password, user.hashedPassword);
    if (!isValid) {
      sendErrorResponse(res, "密碼錯誤", 401);
      return;
    }

    const token = generateToken(
      { id: user.id.toString(), role: user.role },
      "1h"
    );

    sendSuccessResponse(res, {
      token,
      user: {
        id: user.id,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[login] Error:", err);
    sendErrorResponse(res, "登入失敗", 500);
  }
};

/**
 * Verify Email
 * - 無 Email 驗證版本直接關閉
 */
export const verifyEmail = async (
  _req: Request,
  res: Response
): Promise<void> => {
  sendErrorResponse(res, "Email 驗證功能未啟用", 404);
};

/**
 * Resend Verification Email
 * - 無 Email 驗證版本直接關閉
 */
export const resendVerification = async (
  _req: Request,
  res: Response
): Promise<void> => {
  sendErrorResponse(res, "Email 驗證功能未啟用", 404);
};
