// src/controllers/llm.controller.ts

import { Request, Response } from 'express';
import { generateLlmResponse } from '../services/llm.service';

/**
 * 處理 POST /api/llm/chat 請求
 */
export const chatController = async (req: Request, res: Response): Promise<void> => {
    // 1. 輸入驗證
    const { message } = req.body;

    if (typeof message !== 'string' || message.trim() === '') {
        res.status(400).json({ error: "Invalid input: 'message' must be a non-empty string." });
        return;
    }

    try {
        // 2. 呼叫服務層進行業務邏輯
        const llmAnswer = await generateLlmResponse(message);

        // 3. 回傳成功回應 (200 OK)
        res.status(200).json({
            response: llmAnswer
        });
    } catch (error) {
        // 4. 處理服務層拋出的錯誤
        console.error("Error in chatController:", error);
        
        // 回傳 500 內部伺服器錯誤
        res.status(500).json({ 
            error: "An internal server error occurred while processing your request.",
            details: error instanceof Error ? error.message : "Unknown error."
        });
    }
};