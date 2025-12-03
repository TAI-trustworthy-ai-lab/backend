import rateLimit from "express-rate-limit";

export const resendEmailLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 分鐘
  max: 5, // 每個 IP 在 10 分鐘內最多 5 次
  message: {
    status: "error",
    message: "請求過於頻繁，請稍後再試",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
