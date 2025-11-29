import axios from "axios";
import { loadPromptConfig } from "../config/promptConfig";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b:free";
const FALLBACK_MODEL = "google/gemma-2-9b-it:free";
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
  retryCount = 1
): Promise<string> {
  console.log("Preparing to call LLM...");

  // prompt config
  let promptCfg: any = {};
  try {
    promptCfg = loadPromptConfig();
  } catch {
    console.warn("prompt.json 載入失敗（使用預設 system prompt）");
  }

  const systemPrompt = promptCfg?.common_system_prompt || "You are a helpful AI assistant.";

  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  //console.log("this is debug"); // debug
  //console.log(`[LLM] Using model: ${model}`); // debug

  try {
    //console.log("[LLM] sending request to OpenRouter...");
    const resp = await axios.post(OPENROUTER_URL, payload, {
      timeout: 100000, // 100 秒 timeout
      headers: {
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    //console.log("[LLM] got response"); // debug

    return resp.data.choices?.[0]?.message?.content || "";
  } catch (err: any) {
    console.warn("[LLM ERROR RAW]", err.response?.data || err.message);
    console.warn(`[LLM] Model "${model}" failed: ${err.message}`); // debug
    

    // Retry logic
    if (retryCount > 0) {
      console.log(`[LLM] Retrying... Attempts left: ${retryCount}`); // debug
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
