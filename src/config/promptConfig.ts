// src/config/prompt.ts
import fs from "fs";
import path from "path";

export interface PromptConfig {
  common_system_prompt: string;
  background: string;
  TAI_prompt: Record<string, any>;
}

let cachedPrompt: PromptConfig | null = null;

export function loadPromptConfig(): PromptConfig {
  if (cachedPrompt !== null) return cachedPrompt;

  const filePath = path.join(__dirname, "prompt.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);

  cachedPrompt = parsed;
  return parsed;
}
