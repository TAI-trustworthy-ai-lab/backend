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
  console.log("Loading prompt.json ...");

  if (cachedPrompt) return cachedPrompt;

  const filePath = path.join(__dirname, "prompt.json");

  const raw = fs.readFileSync(filePath, "utf-8");
  cachedPrompt = JSON.parse(raw);

  return cachedPrompt;
}
