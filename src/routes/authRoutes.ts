import express from "express";
import {
  register,
  verifyEmail,
  login,
  resendVerification
} from "../controllers/authController";
import { resendEmailLimiter } from "../middlewares/rateLimit";

const router = express.Router();

router.post("/register", register);
router.get("/verify-email", verifyEmail);
router.post("/login", login); // 新的 login

router.post("/resend-verification", resendEmailLimiter, resendVerification);

export default router;
