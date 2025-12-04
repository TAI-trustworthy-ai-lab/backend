import express from "express";
import {
  register,
  verifyEmail,
  login,
  resendVerification
} from "../controllers/authController";
import { resendEmailLimiter } from "../middlewares/rateLimit";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication & email verification APIs
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user with email verification
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: testuser
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *             required:
 *               - name
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Verification email sent
 *       400:
 *         description: Email already registered or invalid data
 *       500:
 *         description: Server error
 */
router.post("/register", register);

/**
 * @swagger
 * /api/auth/verify-email:
 *   get:
 *     summary: Verify user email via token link
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Verification token from email link
 *     responses:
 *       302:
 *         description: Redirect to frontend verify-success page
 *       400:
 *         description: Invalid or expired token
 *       500:
 *         description: Server error
 */
router.get("/verify-email", verifyEmail);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with verified email and get JWT token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Login successful, returns JWT and user role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         role:
 *                           type: string
 *                           example: USER
 *                 message:
 *                   type: string
 *                   example: Request successful
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Wrong password
 *       403:
 *         description: Email not verified
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend email verification link
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: Verification email resent or already verified
 *       400:
 *         description: Email missing in request body
 *       404:
 *         description: Email not found
 *       429:
 *         description: Too many requests, please wait before retrying
 *       500:
 *         description: Server error
 */
router.post("/resend-verification", resendEmailLimiter, resendVerification);

export default router;
