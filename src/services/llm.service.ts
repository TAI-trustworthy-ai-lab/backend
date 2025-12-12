// src/services/llm.service.ts (修正版：System Prompt 使用中文)

import axios from 'axios';
import * as dotenv from 'dotenv';
// 這裡需要根據您實際的檔案結構引入 loadPromptConfig
// import { loadPromptConfig } from "../config/promptConfig"; 

dotenv.config();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b:free"; // 您指定的模型
//const FALLBACK_MODEL = "google/gemma-2-9b-it:free";

/**
 * 呼叫 OpenRouter API 取得 LLM 回應。
 * 這是專門為前端聊天按鈕設計的服務。
 * @param userMessage 使用者傳入的字串
 * @returns LLM 回傳的完整字串
 */
export async function generateLlmResponse(userMessage: string): Promise<string> {
    
    // 原來的 System Prompt 基礎
    const baseSystemPrompt = process.env.CHAT_SYSTEM_PROMPT || "您是一個樂於助人且簡潔的 AI 助理。";

    // **【修正點：在 System Prompt 中加入中文語言指令】**
    const languageInstruction = "如果使用者是用中文提問，請一律使用繁體中文（Traditional Chinese）回答，請**必須**使用**繁體中文**進行輸出；如果使用者是用其他語言（如英文）提問，請用該語言（英文）回答。";
    
    // 合併最終的 System Prompt
    const systemPrompt = baseSystemPrompt + " " + languageInstruction;

    const payload = {
        model: DEFAULT_MODEL,
        messages: [
            // **【Prompt 位置：System Role】**
            { role: "system", content: systemPrompt }, 
            { role: "user", content: userMessage }, // 用戶輸入
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
        console.error(`[LLM Service Error] Model failed: ${err.message}`, err.response?.data);
        throw new Error(`Failed to generate response using ${DEFAULT_MODEL}. Please check API key and network connection.`);
    }
}