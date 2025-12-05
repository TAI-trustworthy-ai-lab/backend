// src/routes/llm.router.ts

import { Router } from 'express';
import { chatController } from '../controllers/llm.controller';

const llmRouter = Router();

// 定義 POST /api/llm/chat 端點
llmRouter.post('/chat', chatController);

export default llmRouter;