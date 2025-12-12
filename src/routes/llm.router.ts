// src/routes/llm.router.ts

import express from "express";
import { chatController } from "../controllers/llm.controller";

const llmRouter = express.Router();

// 定義 POST /api/llm/chat 端點
llmRouter.post("/chat", chatController);

export default llmRouter;