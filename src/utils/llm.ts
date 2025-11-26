import axios from "axios";
import { loadPromptConfig } from "../config/prompt";

export async function callLLM(userPrompt: string, model = "openai/gpt-4.1") {
  const prompts = loadPromptConfig();

  const payload = {
    model,
    messages: [
      { role: "system", content: prompts.common_system_prompt },
      { role: "user", content: userPrompt },
    ],
  };

  const resp = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    payload,
    { headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}` } }
  );

  return resp.data.choices?.[0]?.message?.content || "";
}
