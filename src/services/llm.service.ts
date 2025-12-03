// src/services/llm.service.ts (修正版：使用 OpenRouter)

import axios from 'axios';
import * as dotenv from 'dotenv';
// 這裡需要根據您實際的檔案結構引入 loadPromptConfig
// import { loadPromptConfig } from "../config/promptConfig"; 

dotenv.config();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b:free"; // 您指定的模型
const FALLBACK_MODEL = "google/gemma-2-9b-it:free"; // 備援模型

/**
 * 呼叫 OpenRouter API 取得 LLM 回應。
 * 這是專門為前端聊天按鈕設計的服務。
 * @param userMessage 使用者傳入的字串
 * @returns LLM 回傳的完整字串
 */
export async function generateLlmResponse(userMessage: string): Promise<string> {
    
    // 這裡我們假設 systemPrompt 是固定的或從環境變數讀取，
    // 以避免在聊天服務中引入太多問卷報告的配置。
    const systemPrompt = process.env.CHAT_SYSTEM_PROMPT || "You are a helpful and concise AI assistant.";

    const payload = {
        model: DEFAULT_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ],
    };

    try {
        const resp = await axios.post(OPENROUTER_URL, payload, {
            timeout: 100000, // 100 秒 timeout
            headers: {
                // 從環境變數中讀取金鑰
                Authorization: `Bearer ${process.env.LLM_API_KEY}`, 
                "Content-Type": "application/json",
            },
        });

        const llmAnswer = resp.data.choices?.[0]?.message?.content || "";
        
        if (!llmAnswer) {
            throw new Error("OpenRouter returned an empty response.");
        }
        
        return llmAnswer.trim();

    } catch (err: any) {
        // 這裡可以加入模型切換邏輯，但為了與 reportService 區分，我們只做一次失敗處理
        console.error(`[LLM Service Error] Model failed: ${err.message}`, err.response?.data);
        
        // 拋出錯誤給 Controller 處理
        throw new Error(`Failed to generate response using ${DEFAULT_MODEL}. Please check API key and network connection.`);
    }
}