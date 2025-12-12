// src/services/llm.service.ts

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b:free"; // 您指定的模型

// --- 1. 定義歷史訊息介面 ---
export interface ChatHistoryItem {
    role: string; // 'user' | 'assistant' | 'system'
    content: string;
}

/**
 * 呼叫 OpenRouter API 取得 LLM 回應。
 * @param userMessage 使用者傳入的字串
 * @param history (新增) 對話歷史紀錄
 * @returns LLM 回傳的完整字串
 */
export async function generateLlmResponse(
    userMessage: string, 
    history: ChatHistoryItem[] = [] // <--- 新增參數，預設為空
): Promise<string> {
    
    // System Prompt
    const baseSystemPrompt = process.env.CHAT_SYSTEM_PROMPT || "您是一個樂於助人且簡潔的 AI 助理。";
    const languageInstruction = "如果使用者是用中文提問，請一律使用繁體中文（Traditional Chinese）回答，請**必須**使用**繁體中文**進行輸出；如果使用者是用其他語言（如英文）提問，請用該語言（英文）回答。";
    const systemPrompt = baseSystemPrompt + " " + languageInstruction;

    // --- 2. 處理歷史紀錄 (Token 限制保護) ---
    // 取最近 10 則對話，避免 Token 超過上限或請求過大
    // 這裡我們只保留 user 和 assistant 的發言，過濾掉可能的 system 訊息以免重複
    const recentHistory = history
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .slice(-10);

    const payload = {
        model: DEFAULT_MODEL,
        messages: [
            // 1. System Prompt 永遠在最前
            { role: "system", content: systemPrompt }, 
            
            // 2. 插入歷史紀錄
            ...recentHistory, 

            // 3. 放入當前使用者輸入
            { role: "user", content: userMessage }, 
        ],
    };

    try {
        const resp = await axios.post(OPENROUTER_URL, payload, {
            timeout: 100000, // 100 秒 timeout
            headers: {
                Authorization: `Bearer ${process.env.LLM_API_KEY}`, 
                "Content-Type": "application/json",
                "HTTP-Referer": `${process.env.FRONTEND_URL}`,
                "X-Title": "My Chat App",
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