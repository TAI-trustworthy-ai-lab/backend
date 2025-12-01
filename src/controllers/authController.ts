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
 * -------------------------
 *   Register (含 Email 驗證)
 * -------------------------
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });

    // Email 已驗證 → 不能重複註冊
    if (existing && existing.emailVerified) {
      return sendErrorResponse(res, "此 Email 已被註冊", 400);
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

    return sendSuccessResponse(res, "驗證信已寄出，請至 Email 查收");
  } catch (err) {
    console.error("[register] Error:", err);
    return sendErrorResponse(res, "註冊失敗", 500);
  }
};

/**
 * -------------------------
 *   Verify Email (含前端 redirect)
 * -------------------------
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    const user = await prisma.user.findFirst({
      where: {
        verifyToken: token as string,
        verifyTokenExp: { gt: new Date() },
      },
    });

    if (!user) {
      return sendErrorResponse(res, "驗證連結無效或已過期", 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verifyToken: null,
        verifyTokenExp: null,
      },
    });

    return res.redirect("http://localhost:3000/verify-success");
  } catch (err) {
    console.error("[verifyEmail] Error:", err);
    return sendErrorResponse(res, "Email 驗證失敗", 500);
  }
};

/**
 * -------------------------
 *   Login（需要 Email 已驗證）
 * -------------------------
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendErrorResponse(res, "Email 和 password 都是必填", 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return sendNotFoundResponse(res, "查無此使用者");
    }

    // 必須先驗證 Email
    if (!user.emailVerified) {
      return sendErrorResponse(res, "請先至 Email 完成驗證後再登入", 403);
    }

    const isValid = await comparePasswords(password, user.hashedPassword);
    if (!isValid) {
      return sendErrorResponse(res, "密碼錯誤", 401);
    }

    // 產生 JWT
    const token = generateToken(
      { id: user.id.toString(), role: user.role },
      "1h"
    );

    return sendSuccessResponse(res, {
      token,
      user: {
        id: user.id,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[login] Error:", err);
    return sendErrorResponse(res, "登入失敗", 500);
  }
};

/**
 * ======================================================
 *  Resend Verification Email — 重送驗證信
 * ======================================================
 */
export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendErrorResponse(res, "Email 為必填欄位", 400);
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return sendNotFoundResponse(res, "查無此 Email 對應的使用者");
    }

    // 已驗證：不需再寄
    if (user.emailVerified) {
      return sendSuccessResponse(res, {
        message: "此 Email 已完成驗證，無需重送驗證信",
      });
    }

    // 限制：5 分鐘內不能重送
    if (user.verifyTokenExp && user.verifyTokenExp > new Date()) {
      const waitSeconds = Math.ceil(
        (user.verifyTokenExp.getTime() - Date.now()) / 1000
      );
      return sendErrorResponse(
        res,
        `請稍後再試，剩餘 ${waitSeconds} 秒後可重新寄送驗證信`,
        429
      );
    }

    // 產生新 Token（有效期 10 分鐘）
    const token = crypto.randomBytes(40).toString("hex");
    const expire = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyToken: token,
        verifyTokenExp: expire,
      },
    });

    // 重送新驗證信
    const verifyUrl = `http://localhost:3001/api/auth/verify-email?token=${token}`;
    await sendVerificationEmail(email, verifyUrl);

    return sendSuccessResponse(res, "驗證信已重新寄出，請至 Email 查收");
  } catch (err) {
    console.error("[resendVerification] Error:", err);
    return sendErrorResponse(res, "重送驗證信失敗", 500);
  }
};
