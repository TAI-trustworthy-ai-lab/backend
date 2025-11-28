import axios from "axios";
import { loadPromptConfig } from "../config/prompt";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4.1";          // 主模型
const FALLBACK_MODEL = "google/gemini-2.0-pro";   // 備用模型

/**
 * Call LLM using OpenRouter
 * Includes:
 * - timeout
 * - retry
 * - model fallback
 * - structured error handling
 */
export async function callLLM(
  userPrompt: string,
  model: string = DEFAULT_MODEL,
  retryCount = 2
): Promise<string> {
  const prompts = loadPromptConfig();
  const systemPrompt = prompts?.common_system_prompt || "You are a helpful AI.";

  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  try {
    const resp = await axios.post(OPENROUTER_URL, payload, {
      timeout: 100000, // 100 秒 timeout
      headers: {
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    return resp.data.choices?.[0]?.message?.content || "";
  } catch (err: any) {
    console.warn(`[LLM] Model "${model}" failed: ${err.message}`);

    // Retry logic
    if (retryCount > 0) {
      console.log(`[LLM] Retrying... Attempts left: ${retryCount}`);
      await new Promise((r) => setTimeout(r, 1200)); // 1.2s retry delay
      return callLLM(userPrompt, model, retryCount - 1);
    }

    // Final fallback → switch to backup model
    if (model !== FALLBACK_MODEL) {
      console.warn(`[LLM] Switching to fallback model: ${FALLBACK_MODEL}`);
      return callLLM(userPrompt, FALLBACK_MODEL, 1);
    }

    // Completely failed → return safe template
    return `AI 無法生成分析（模型超時或服務暫時不可用）。
請稍後再試。`;
  }
}
