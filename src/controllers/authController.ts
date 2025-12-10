import crypto from "crypto";
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

import { sendVerificationEmail } from "../utils/emailSender";
import { hashPassword, comparePasswords } from "../utils/bcryptHandler";
import { generateToken } from "../utils/jwtHandler";

import {
  sendSuccessResponse,
  sendErrorResponse,
  sendNotFoundResponse,
} from "../utils/responseHandler";

const prisma = new PrismaClient();

/**
 * register + email verification
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });

    // Email 已驗證 → 不能重複註冊
    if (existing && existing.emailVerified) {
      sendErrorResponse(res, "此 Email 已被註冊", 400);
      return;
    }

    // 產生 Email 驗證 token
    const token = crypto.randomBytes(40).toString("hex");
    const expire = new Date(Date.now() + 10 * 60 * 1000); // 10 分鐘

    let user;

    if (!existing) {
      const hashed = await hashPassword(password);

      user = await prisma.user.create({
        data: {
          name,
          email,
          hashedPassword: hashed,
          verifyToken: token,
          verifyTokenExp: expire,
        },
      });
    } else {
      // 已存在但未驗證 → 更新 token
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          verifyToken: token,
          verifyTokenExp: expire,
        },
      });
    }

    // 寄出驗證信
    const verifyUrl = `http://localhost:3001/api/auth/verify-email?token=${token}`;
    await sendVerificationEmail(email, verifyUrl);

    sendSuccessResponse(res, "驗證信已寄出，請至 Email 查收");
  } catch (err) {
    console.error("[register] Error:", err);
    sendErrorResponse(res, "註冊失敗", 500);
  }
};

/**
 * Verify Email
 */
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;

    const user = await prisma.user.findFirst({
      where: {
        verifyToken: token as string,
        verifyTokenExp: { gt: new Date() },
      },
    });

    if (!user) {
      sendErrorResponse(res, "驗證連結無效或已過期", 400);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verifyToken: null,
        verifyTokenExp: null,
      },
    });

    res.redirect("http://localhost:3000/verify-success");
  } catch (err) {
    console.error("[verifyEmail] Error:", err);
    sendErrorResponse(res, "Email 驗證失敗", 500);
  }
};

/**
 *   Login
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

    if (!user.emailVerified) {
      sendErrorResponse(res, "請先至 Email 完成驗證後再登入", 403);
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
 * Resend Verification Email
 */
export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      sendErrorResponse(res, "Email 為必填欄位", 400);
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      sendNotFoundResponse(res, "查無此 Email 對應的使用者");
      return;
    }

    if (user.emailVerified) {
      sendSuccessResponse(res, {
        message: "此 Email 已完成驗證，無需重送驗證信",
      });
      return;
    }

    if (user.verifyTokenExp && user.verifyTokenExp > new Date()) {
      sendErrorResponse(res, "請稍後再試，驗證信正在冷卻中", 429);
      return;
    }

    const token = crypto.randomBytes(40).toString("hex");
    const expire = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyToken: token,
        verifyTokenExp: expire,
      },
    });

    const verifyUrl = `http://localhost:3001/api/auth/verify-email?token=${token}`;
    await sendVerificationEmail(email, verifyUrl);

    sendSuccessResponse(res, "驗證信已重新寄出，請至 Email 查收");
  } catch (err) {
    console.error("[resendVerification] Error:", err);
    sendErrorResponse(res, "重送驗證信失敗", 500);
  }
};
