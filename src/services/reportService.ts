import axios from "axios";
import fs from "fs";
import path from "path";
import { loadPromptConfig } from "../config/prompt";
import { generateRadar } from "../utils/taiRadar";
import { callLLM } from "../utils/llm";

export class ReportService {
  async fetchResponse(id: number, apiTemplate: string) {
    const url = apiTemplate.replace("{id}", String(id));
    const resp = await axios.get(url);
    return resp.data;
  }

  extractAnswers(apiData: any) {
    const answers = apiData?.data?.answers || [];
    return answers.map((a: any) => ({
      axis: a.question.category,
      value: Number(a.value),
      text: a.question.text,
    }));
  }

  computeScores(answers: any[]) {
    const byAxis: Record<string, number[]> = {};

    for (const a of answers) {
      if (!byAxis[a.axis]) byAxis[a.axis] = [];
      byAxis[a.axis].push(a.value / 100);
    }

    const scores: Record<string, number> = {};

    for (const axis in byAxis) {
      const arr = byAxis[axis];
      const avg = arr.reduce((s, x) => s + x, 0) / arr.length;
      scores[axis] = avg;
    }

    return scores;
  }

  async generateReport(responseId: number) {
    const apiTemplate = process.env.RESPONSE_API!;
    const data = await this.fetchResponse(responseId, apiTemplate);

    const answers = this.extractAnswers(data);
    const scores = this.computeScores(answers);

    const outDir = path.resolve("outputs");
    fs.mkdirSync(outDir, { recursive: true });

    const radarPath = `${outDir}/radar_${Date.now()}.png`;
    generateRadar(scores, radarPath);

    const prompt = `
Voici les scores TAI :
${JSON.stringify(scores, null, 2)}

Donne une analyse structurée et claire en 150+ mots.
`;

    const llmText = await callLLM(prompt);

    return {
      responseId,
      scores,
      radarImage: radarPath,
      llmAnalysis: llmText,
    };
  }
}

export const reportService = new ReportService();
