import fs from "fs";
import path from "path";

export interface PromptConfig {
  common_system_prompt: string;
  background: string;
  TAI_prompt: Record<string, any>;
}

let cachedPrompt: PromptConfig | null = null;

export function loadPromptConfig(): PromptConfig {
  if (cachedPrompt) return cachedPrompt;

  const filePath = path.resolve(process.cwd(), "prompt/Prompt.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedPrompt = JSON.parse(raw);

  return cachedPrompt!;
}
