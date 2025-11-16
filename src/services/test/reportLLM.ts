import * as fs from 'fs';
import * as path from 'path'; // <-- 確保 'path' 模組有被匯入
import axios from 'axios';
import { config as configDotenv } from 'dotenv';
import { Chart, registerables } from 'chart.js';
import { createCanvas, Canvas } from 'canvas';
import { Command } from 'commander';
import { performance } from 'perf_hooks'; // 用於 timeout，雖然 axios 內建

// ============================================================
//  一、TAI 常數與 Prompt 設定
// ============================================================

const TAI_AXES: string[] = [
  'Accuracy',
  'Reliability',
  'Safety',
  'Resilience',
  'Explainability',
  'Autonomy',
  'Privacy',
  'Security',
  'Transparency',
  'Accountability',
  'Fairness',
];

const CATEGORY_TO_AXIS: Record<string, string> = {
  ACCURACY: 'Accuracy',
  RELIABILITY: 'Reliability',
  SAFETY: 'Safety',
  RESILIENCE: 'Resilience',
  EXPLAINABILITY: 'Explainability',
  AUTONOMY: 'Autonomy',
  PRIVACY: 'Privacy',
  SECURITY: 'Security',
  TRANSPARENCY: 'Transparency',
  ACCOUNTABILITY: 'Accountability',
  FAIRNESS: 'Fairness',
};

const YES_ALIASES = new Set(['是', 'yes', 'y', 'true', '1', '✓', '√']);
const NO_ALIASES = new Set(['否', 'no', 'n', 'false', '0', '✗', 'x']);
const NA_ALIASES = new Set(['不適用', 'na', 'n/a', 'null', 'none', '-', '']);

// --- Prompt 設定的全域變數（由 Prompt.json 載入） ---
let PROMPT_CONFIG: Record<string, any> = {};
let PROMPT_SYSTEM: string = '';
let PROMPT_BACKGROUND: string = '';
let PROMPT_TAI: Record<string, Record<string, Record<string, string>>> = {};

// 定義一些型別
interface Answer {
  axis: string;
  value: any;
  questionId: number | string;
  text: string;
  stage?: string | null;
  type?: string | null;
  binarize?: any;
  weight?: number;
  options?: any;
}

interface QuestionMetadata {
  id: number;
  text?: string;
  stage?: string;
  type?: string;
  axis?: string;
  binarize_json?: any;
  weight?: number;
  options_json?: any;
  [key: string]: any;
}

interface Counts {
  yes: number;
  no: number;
  na: number;
}

interface LLMData {
  stage: string | null;
  full: [string, number][];
  mostly: [string, number][];
  partial: [string, number][];
  none: [string, number][];
}

// +++ 函式已修改 +++
function loadPromptConfig(configPath: string = 'Prompt.json'): void {
  /**
   * 從 Prompt.json 載入：
   * - common_system_prompt
   * - background
   * - TAI_prompt
   */

  // 建立一個相對於 *目前檔案* (`reportLLM.ts`) 的絕對路徑
  // __dirname 是 `reportLLM.ts` 所在的資料夾 (例如 src/services/test)
  const absolutePath = path.join(__dirname, configPath);

  try {
    // const fileContent = fs.readFileSync(configPath, 'utf-8'); // <-- 舊的程式碼
    const fileContent = fs.readFileSync(absolutePath, 'utf-8'); // <-- 改用絕對路徑
    PROMPT_CONFIG = JSON.parse(fileContent);
    PROMPT_SYSTEM = PROMPT_CONFIG['common_system_prompt'] || '';
    PROMPT_BACKGROUND = PROMPT_CONFIG['background'] || '';
    PROMPT_TAI = PROMPT_CONFIG['TAI_prompt'] || {};
    console.log(`[OK] 已載入 Prompt 設定：${absolutePath}`); // <-- 顯示正確的路徑
  } catch (e: any) {
    // console.warn(`[WARN] 無法載入 Prompt.json：${e.message}`); // <-- 舊的程式碼
    console.warn(
      `[WARN] 無法載入 Prompt.json 於 ${absolutePath}：${e.message}`,
    ); // <-- 顯示我們嘗試的路徑
    PROMPT_CONFIG = {};
    PROMPT_SYSTEM = '';
    PROMPT_BACKGROUND = '';
    PROMPT_TAI = {};
  }
}
// +++ 函式修改結束 +++

// +++ 立即呼叫 +++
// 在頂層呼叫，確保 import 時就能載入設定
// configDotenv(); // <-- 【修改】註解掉 (防止 import 時觸發)
// loadPromptConfig(); // <-- 【修改】註解掉 (防止 import 時觸發)

function stageToQuestionnaireType(stage?: string | null): string {
  /**
   * 從題目 metadata 的 stage（例如 pre/mid/post）推回「建模前/中/後」。
   * 若未知則預設為「建模後」。
   */
  if (!stage) {
    return '建模後';
  }
  const s = String(stage).toLowerCase();
  if (s.includes('pre') || s.includes('before')) {
    return '建模前';
  }
  if (s.includes('mid') || s.includes('during')) {
    return '建模中';
  }
  if (s.includes('post') || s.includes('after')) {
    return '建模後';
  }
  return '建模後';
}

function _norm(v: string | boolean | number | null | undefined): string {
  /** 把各式填答正規化成 yes/no/na 三類其一，或原字串。 */
  if (v === null || v === undefined) {
    return 'na';
  }
  if (typeof v === 'boolean') {
    return v ? 'yes' : 'no';
  }
  if (typeof v === 'number') {
    if (v === 1) return 'yes';
    if (v === 0) return 'no';
    return 'na';
  }
  const s = String(v).trim().toLowerCase();
  if (YES_ALIASES.has(s)) return 'yes';
  if (NO_ALIASES.has(s)) return 'no';
  if (NA_ALIASES.has(s)) return 'na';
  return s; // 其他非二元題：保留原字串
}

function _dig(d: any, ...keys: (string | number)[]): any {
  /** 安全地往下取值：_dig(obj,'a','b','c') */
  let cur = d;
  for (const k of keys) {
    if (cur && typeof cur === 'object' && k in cur) {
      cur = cur[k];
    } else if (Array.isArray(cur) && typeof k === 'number' && k < cur.length) {
      cur = cur[k];
    } else {
      return undefined; // 'default' is handled by '||' operator at call site
    }
  }
  return cur;
}

// ============================================================
//  二、資料來源：回應與題目目錄
// ============================================================

async function fetchResponseJson(
  responseId: number | string,
  apiTemplate: string,
): Promise<any> {
  /**
   * 呼叫 API 取得 JSON。
   * apiTemplate 例如："http://localhost:3001/api/response/id/{id}"。
   * 若取得結果為空，會嘗試幾種常見替代路徑。
   */

  const _get = async (url: string): Promise<any | null> => {
    try {
      console.log(`[GET] ${url}`);
      const r = await axios.get(url, { timeout: 30000 });
      return r.data;
    } catch (e: any) {
      if (e.response && e.response.status === 404) {
        return null;
      }
      console.warn(`[WARN] GET 失敗：${e.message}`);
      return null;
    }
  };

  const _extractNonEmpty = (d: any): boolean => {
    if (d === null || d === undefined) {
      return false;
    }
    if (typeof d === 'object' && Array.isArray(d.data)) {
      return d.data.length > 0;
    }
    if (Array.isArray(d)) {
      return d.length > 0;
    }
    return true;
  };

  // 1) 直接用模板
  const url = apiTemplate.replace('{id}', String(responseId));
  let data = await _get(url);

  if (_extractNonEmpty(data)) {
    return data;
  }

  // 2) 常見替代路徑 (Typescript 中實現)
  const alts: string[] = [];
  let base = apiTemplate;
  if (base.includes('{id}')) {
    alts.push(base.replace('/response/{id}', '/responses/{id}'));
    alts.push(base.replace('/response/{id}', '/response?id={id}'));
    alts.push(base.replace('/response/{id}', '/responses?id={id}'));
  }
  alts.push(base.replace('/responses/{id}', '/response/{id}'));
  alts.push(base.replace('/responses/{id}', '/responses?id={id}'));
  alts.push(base.replace('/responses/{id}', '/response?id={id}'));

  for (const t of alts) {
    if (t === apiTemplate) continue;
    const d2 = await _get(t.replace('{id}', String(responseId)));
    if (_extractNonEmpty(d2)) {
      return d2;
    }
  }

  // 3) 嘗試 "列出全部"
  const listCandidates = [
    base.replace('/{id}', ''),
    base.replace('response/{id}', 'responses'),
    base.replace('responses/{id}', 'responses'),
  ];

  for (const t of listCandidates) {
    const d3 = await _get(t);
    if (d3 === null || d3 === undefined) continue;

    const rid = parseInt(String(responseId), 10);
    const arr =
      typeof d3 === 'object' && d3.data
        ? d3.data
        : Array.isArray(d3)
        ? d3
        : null;

    if (Array.isArray(arr)) {
      for (const obj of arr) {
        if (typeof obj === 'object' && obj.id === rid) {
          return { success: true, data: [obj] };
        }
      }
    }
    if (_extractNonEmpty(d3)) {
      return d3;
    }
  }

  return data;
}

function loadQuestionCatalog(
  filePath: string | undefined | null,
): Record<number, QuestionMetadata> {
  /** 讀本地快取的問題目錄：{ "questionnaire_id": ..., "questions": [ {...}, ... ] } → {qid: meta} */
  if (!filePath) {
    return {};
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const questions: QuestionMetadata[] = data.questions || [];
    const catalog: Record<number, QuestionMetadata> = {};
    for (const q of questions) {
      if (q.id) {
        catalog[Number(q.id)] = q;
      }
    }
    return catalog;
  } catch (e: any) {
    console.warn(`[WARN] 讀取 question-catalog 失敗：${e.message}`);
    return {};
  }
}

function loadQidAxisMap(
  filePath: string | undefined | null,
): Record<number, string> {
  /** 讀 {questionId: AxisName} 的備援對應。 */
  if (!filePath) {
    return {};
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const map: Record<number, string> = {};
    for (const k in data) {
      map[Number(k)] = String(data[k]);
    }
    return map;
  } catch (e: any) {
    console.warn(`[WARN] 讀取 qid-axis 對應檔失敗：${e.message}`);
    return {};
  }
}

function extractAnswersList(apiData: any): Answer[] {
  /**
   * 將 response JSON 裡的 answers 取出並整理成統一格式
   */
  let answersRaw: any[] | null = null;

  // 新 API 格式：data 是物件，裡面有 answers
  if (typeof apiData === 'object' && apiData !== null) {
    const dataField = apiData.data;
    if (
      typeof dataField === 'object' &&
      dataField !== null &&
      Array.isArray(dataField.answers)
    ) {
      answersRaw = dataField.answers;
    }

    // fallback：data 是 list
    if (answersRaw === null && Array.isArray(dataField) && dataField.length > 0) {
      const first = dataField[0];
      if (
        typeof first === 'object' &&
        first !== null &&
        Array.isArray(first.answers)
      ) {
        answersRaw = first.answers;
      }
    }
  }

  if (!Array.isArray(answersRaw)) {
    return [];
  }

  const out: Answer[] = [];

  for (const item of answersRaw) {
    if (typeof item !== 'object' || item === null) continue;

    const qMeta = item.question || {};
    const qid = item.questionId || qMeta.id;

    // category 直接對應到 TAI 軸（你後端是大寫英文）
    const category = qMeta.category;
    let axis: string;
    if (typeof category === 'string') {
      axis = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase(); // RELIABILITY → Reliability
    } else {
      axis = `Q${qid}`;
    }

    const rawValue = item.value; // 0~100 已經是你們定義好的值
    const text = qMeta.text || item.text || `Q${qid}`;

    out.push({
      axis: axis,
      value: rawValue,
      questionId: qid,
      text: text,
      stage: qMeta.stage,
      type: qMeta.type || 'SINGLE_CHOICE',
    });
  }
  return out;
}

// ============================================================
//  三、合併 metadata & 二值化彙整
// ============================================================

function attachMetadata(
  answers: Answer[],
  catalog: Record<number, QuestionMetadata>,
  qidAxis: Record<number, string>,
): Answer[] {
  /** 把題目目錄（或備援對應）合併到答案列。 */
  const out: Answer[] = [];
  for (const it of answers) {
    const qid = it.questionId;
    let meta: QuestionMetadata | {} = {};
    try {
      if (qid !== null && qid !== undefined) {
        meta = catalog[Number(qid)] || {};
      }
    } catch (e) {
      meta = {};
    }

    // Axis 來源優先順序：API → catalog → fallback map → “Qid”
    const axis =
      it.axis ||
      (meta as QuestionMetadata).axis ||
      (qid !== null && qid !== undefined ? qidAxis[Number(qid)] : null);

    // 🔥 重點：題目文字優先順序
    const text = (meta as QuestionMetadata).text || it.text || `Q${qid}`;

    out.push({
      ...it,
      axis: String(axis || `Q${qid}`),
      stage: (meta as QuestionMetadata).stage,
      type: (meta as QuestionMetadata).type,
      text: text,
      binarize: (meta as QuestionMetadata).binarize_json,
      weight: (meta as QuestionMetadata).weight || 1.0,
      options: (meta as QuestionMetadata).options_json,
    });
  }
  return out;
}

function likertToYesNo(value: any, yesMin: number = 4, noMax: number = 2): string {
  /** 1~5 Likert 轉 yes/no/na。 */
  try {
    const v = parseInt(value, 10);
    if (isNaN(v)) throw new Error();
    if (v >= yesMin) return 'yes';
    if (v <= noMax) return 'no';
    return 'na';
  } catch (e) {
    return _norm(value);
  }
}

function binarize(
  value: any,
  item: Answer,
  defaultYesMin = 4,
  defaultNoMax = 2,
): string {
  const bz = item.binarize || {};
  const t = (item.type || '').toLowerCase();

  // likert / scale 題轉 yes/no
  if (t.startsWith('likert') || t.startsWith('scale')) {
    const yesMin = parseInt(bz.yes_min, 10) || defaultYesMin;
    const noMax = parseInt(bz.no_max, 10) || defaultNoMax;
    return likertToYesNo(value, yesMin, noMax);
  }
  return _norm(value);
}

function toCountsByAxis(
  answers: Answer[],
  likertYesMin: number = 4,
  likertNoMax: number = 2,
): Record<string, Counts> {
  /** 把逐題答案彙整成 {axis: {yes,no,na}} 統計；支援題級覆寫閾值。 */
  const counts: Record<string, Counts> = {};
  for (const it of answers) {
    const axis = String(it.axis || '').trim();
    if (!axis) continue;

    const val = binarize(it.value, it, likertYesMin, likertNoMax);

    if (!counts[axis]) {
      counts[axis] = { yes: 0, no: 0, na: 0 };
    }

    if (val === 'yes') {
      counts[axis].yes++;
    } else if (val === 'no') {
      counts[axis].no++;
    } else {
      counts[axis].na++;
    }
  }
  return counts;
}

function toAnswersByAxis(answers: Answer[]): Record<string, number[]> {
  const byAxis: Record<string, number[]> = {};
  for (const it of answers) {
    const axis = String(it.axis || '').trim();
    if (!axis) continue;

    const v = parseFloat(it.value);
    if (isNaN(v)) continue;

    if (!byAxis[axis]) {
      byAxis[axis] = [];
    }
    byAxis[axis].push(v);
  }
  return byAxis;
}

function buildLlmDataFromAnswers(answers: Answer[]): Record<string, LLMData> {
  /**
   * 對每一個軸分類四層級：
   * full    → 完全做到
   * mostly  → 大部分做到
   * partial → 少部分做到
   * none    → 尚未做到
   */
  const data: Record<string, LLMData> = {};

  for (const it of answers) {
    const axis = String(it.axis || '').trim();
    if (!axis) continue;

    let score: number;
    try {
      score = parseFloat(it.value);
      if (isNaN(score)) continue;
    } catch {
      continue;
    }

    const text = it.text || `Q${it.questionId}`;
    const stage = it.stage || null;
    const level = classifyLevel(score);

    if (!data[axis]) {
      data[axis] = {
        stage: stage,
        full: [],
        mostly: [],
        partial: [],
        none: [],
      };
    }

    data[axis][level].push([text, score]);
  }
  return data;
}

// ============================================================
//  四、計分與雷達圖
// ============================================================

const mean = (arr: number[]): number => {
  const filtered = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
  return filtered.length
    ? filtered.reduce((a, b) => a + b, 0) / filtered.length
    : NaN;
};

function scoreFromAnswers(
  answersByAxis: Record<string, any[]>,
): Record<string, number> {
  /**
   * 雷達圖分數 = 每一題的 value / 100 的平均。
   */
  const scores: Record<string, number> = {};
  for (const axis in answersByAxis) {
    const values = answersByAxis[axis];
    const vals = values
      .map(v => parseFloat(v))
      .filter(fv => !isNaN(fv) && fv >= 0 && fv <= 100)
      .map(fv => fv / 100.0);

    scores[axis] = vals.length ? mean(vals) : NaN;
  }
  return scores;
}

function classifyLevel(
  score: number,
  fullMin: number = 80.0,
  mostlyMin: number = 60.0,
  partialMin: number = 40.0,
): 'full' | 'mostly' | 'partial' | 'none' {
  /**
   * score: 0~100
   * 回傳四個層級：full / mostly / partial / none
   */
  if (score >= fullMin) return 'full';
  if (score >= mostlyMin) return 'mostly';
  if (score >= partialMin) return 'partial';
  return 'none';
}

function scoreFromCounts(
  countsByAxis: Record<string, Counts>,
): Record<string, number> {
  /** 以二值化統計計分：分數 = yes / (yes+no) */
  const scores: Record<string, number> = {};
  for (const axis in countsByAxis) {
    const c = countsByAxis[axis];
    const y = c.yes || 0;
    const n = c.no || 0;
    const denom = y + n;
    scores[axis] = denom > 0 ? y / denom : NaN;
  }
  return scores;
}

function plotTaiRadar(
  scores: Record<string, number>,
  title: string = 'TAI Trustworthy AI Radar',
  saveAs: string | null = null,
): void {
  // 註冊 Chart.js 相關元件
  Chart.register(...registerables);

  const labels = TAI_AXES;
  const values: number[] = [];
  for (const axis of labels) {
    const v = scores[axis];
    values.push(v === null || v === undefined || isNaN(v) ? 0.0 : v);
  }

  const width = 700;
  const height = 700;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as any; // node-canvas 需要 'any'

  const chartConfig: any = {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Score',
          data: values,
          fill: true,
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgb(54, 162, 235)',
          pointBackgroundColor: 'rgb(54, 162, 235)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(54, 162, 235)',
        },
      ],
    },
    options: {
      // 顏色設定（上次修正的）
      scales: {
        r: {
          min: 0,
          max: 1.0,
          ticks: {
            stepSize: 0.2,
            backdropColor: 'transparent',
            color: '#666', // 數字
            callback: (value: any) => value.toFixed(1),
          },
          pointLabels: {
            font: { size: 12 },
            color: '#333', // 標籤
          },
          angleLines: {
            color: '#DDD', // 放射線
          },
          grid: {
            color: '#DDD', // 網格
          },
        },
      },
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: 16 },
          padding: { top: 10, bottom: 20 },
          color: '#333', // 標題
        },
        legend: {
          display: false,
        },
      },
      responsive: false,
      animation: false,
    },

    // 使用外掛在 "底下" 畫上白色背景（上次修正的）
    plugins: [
      {
        id: 'customCanvasBackgroundColor',
        beforeDraw: (chart: any) => {
          const { ctx, width, height } = chart;
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#ffffff'; // 填滿白色
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        },
      },
    ],
  };

  // 建立圖表
  new Chart(ctx, chartConfig);

  if (saveAs) {
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(saveAs, buffer);
  }
}

// ============================================================
//  五、LLM 呼叫
// ============================================================

interface LLMResult {
  error: string | null;
  content: string | null;
  raw: any | null;
}

async function callLlmScout(
  systemPrompt: string,
  userPrompt: string,
  model = 'openai/gpt-oss-20b:free',
  timeout = 60000,
): Promise<LLMResult> {
  // configDotenv(); // 確保 .env 已載入 (移到頂層)
  const apiKey = process.env.LLM_API_KEY;
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (!apiKey) {
    return {
      error: '缺少環境變數 LLM_API_KEY，已略過 LLM 產生建議。',
      content: null,
      raw: null,
    };
  }

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  try {
    const resp = await axios.post(url, payload, { headers, timeout });
    const data = resp.data;
    const content = _dig(data, 'choices', 0, 'message', 'content') || '';
    return { error: null, content: content, raw: data };
  } catch (e: any) {
    const errorText = e.response
      ? `HTTP ${e.response.status}: ${JSON.stringify(e.response.data)}`
      : e.message;
    return { error: errorText, content: null, raw: e.response?.data || null };
  }
}

type LLMCallFn = (systemPrompt: string, userPrompt: string) => Promise<LLMResult>;

async function generateLlmSections(
  llmDataByAxis: Record<string, LLMData>,
  callFn: LLMCallFn,
  globalQuestionnaireType?: string | null, // <-- ⭐ 新增 (來自 Python 變更)
): Promise<any[]> {
  const formatGroup = (title: string, items: [string, number][]): string => {
    if (!items || items.length === 0) {
      return `${title}\n（目前沒有項目）\n\n`;
    }
    const lines = [title];
    items.forEach(([text, score], idx) => {
      lines.push(`${idx + 1}. ${text}（目前分數：${score.toFixed(0)}）`);
    });
    return lines.join('\n') + '\n\n';
  };

  const sections: any[] = [];

  for (const axis in llmDataByAxis) {
    const info = llmDataByAxis[axis];
    const stageRaw = info.stage;

    let questionnaireType: string;
    // ******** ⭐ 邏輯更新 (來自 Python 變更) START ********
    if (stageRaw) {
      questionnaireType = stageToQuestionnaireType(stageRaw);
    } else if (globalQuestionnaireType) {
      questionnaireType = globalQuestionnaireType; // 使用從 API 傳入的 fallback
    } else {
      questionnaireType = '建模後'; // 最終 fallback
    }
    // ******** ⭐ 邏輯更新 (來自 Python 變更) END ********

    const axisIntro =
      _dig(PROMPT_TAI, questionnaireType, axis, 'content') || '';

    const userPrompt =
      (PROMPT_BACKGROUND || '') +
      axisIntro +
      formatGroup('我們有完全做到：', info.full || []) +
      formatGroup('我們有大部分做到：', info.mostly || []) +
      formatGroup('我們有少部分做到：', info.partial || []) +
      formatGroup('我們尚未做到：', info.none || []);

    const systemPrompt = PROMPT_SYSTEM || '你是一位可信任 AI 顧問。';
    const result = await callFn(systemPrompt, userPrompt);

    sections.push({
      axis: axis,
      questionnaire_type: questionnaireType,
      stage_raw: stageRaw,
      full: info.full || [],
      mostly: info.mostly || [],
      partial: info.partial || [],
      none: info.none || [],
      llm_output: result.content,
      llm_error: result.error,
    });
  }
  return sections;
}

// ============================================================
//  六、整合：輸出最終報告
// ============================================================

async function integrateAndGenerateReport({
  scores,
  answersByAxis,
  countsByAxis,
  title = 'TAI Radar (Integrated Final Report)',
  outDir = 'outputs',
  llm_data_by_axis,
  llm_call,
  questionnaire_type, // <-- ⭐ 新增 (來自 Python 變更)
}: {
  scores?: Record<string, number>;
  answersByAxis?: Record<string, number[]>;
  countsByAxis?: Record<string, Counts>;
  title?: string;
  outDir?: string;
  llm_data_by_axis?: Record<string, LLMData> | null;
  llm_call?: LLMCallFn;
  questionnaire_type?: string | null; // <-- ⭐ 新增 (來自 Python 變更)
}): Promise<{ jsonPath: string; report: any }> {
  fs.mkdirSync(outDir, { recursive: true });
  // 修正時間戳格式，避免 ":" 造成 Windows 路徑問題
  const ts = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .slice(0, 19)
    .replace('T', '_');
  const imgPath = path.join(outDir, `tai_radar_${ts}.png`);
  const jsonPath = path.join(outDir, `final_report_${ts}.json`);

  let finalScores: Record<string, number>;

  if (scores) {
    finalScores = scores;
  } else if (answersByAxis) {
    finalScores = scoreFromAnswers(answersByAxis);
  } else if (countsByAxis) {
    finalScores = scoreFromCounts(countsByAxis);
  } else {
    throw new Error('請提供 scores 或 answers_by_axis / counts_by_axis 其中之一。');
  }

  plotTaiRadar(finalScores, title, imgPath);

  const numeric = Object.values(finalScores).filter(
    v => v !== null && v !== undefined && !isNaN(v),
  );
  const overallMean = numeric.length ? mean(numeric) : null;
  const scoredAxes = numeric.length;
  const totalAxes = 11;

  let sections: any[] = [];
  if (llm_data_by_axis) {
    const _call = llm_call || callLlmScout;
    // ******** ⭐ 傳入 questionnaire_type (來自 Python 變更) ********
    sections = await generateLlmSections(
      llm_data_by_axis,
      _call,
      questionnaire_type,
    );
  }

  const report = {
    meta: {
      generated_at: ts,
      title: title,
      radar_image_path: imgPath,
    },
    scores: finalScores,
    summary: {
      overall_mean: overallMean,
      scored_axes: scoredAxes,
      total_axes: totalAxes,
    },
    llm: { sections: sections },
  };

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`[OK] JSON 報告輸出：${jsonPath}`);
  console.log(`[OK] 雷達圖輸出：${imgPath}`);
  return { jsonPath, report };
}

// ============================================================
//  七、主流程：給一個 response_id → 回傳報告
// ============================================================

async function generateReportForResponse({
  responseId,
  apiTemplate,
  mode,
  outDir,
  title,
  qApiTemplate,
  questionCatalogPath,
  qidAxisMapPath,
  likertYesMin = 4,
  likertNoMax = 2,
  saveCatalogSnapshot = false,
  withLlm = false,
  llmCall,
}: {
  responseId: string | number;
  apiTemplate: string;
  mode: 'counts' | 'answers';
  outDir: string;
  title: string;
  qApiTemplate?: string | null;
  questionCatalogPath?: string | null;
  qidAxisMapPath?: string | null;
  likertYesMin?: number;
  likertNoMax?: number;
  saveCatalogSnapshot?: boolean;
  withLlm?: boolean;
  llmCall?: LLMCallFn;
}): Promise<[string, any]> {
  // 1) 取 response
  const data = await fetchResponseJson(responseId, apiTemplate);

  // 1.1 存原始 API 回應
  fs.mkdirSync(outDir, { recursive: true });
  const rawPath = path.join(outDir, `response_${responseId}.raw.json`);
  fs.writeFileSync(rawPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[OK] 原始 API 回應已存：${rawPath}`);

  // 2) 解析答案
  let answers = extractAnswersList(data);

  // 3) 找 questionnaire 版本 → 取得題目目錄
  // ******** ⭐ 邏輯更新 (來自 Python 變更) START ********
  const version_id =
    _dig(data, 'data', 'versionId') ||
    _dig(data, 'data', 0, 'versionId') ||
    _dig(data, 'versionId');

  const questionnaireId =
    _dig(data, 'data', 0, 'questionnaireId') || _dig(data, 'questionnaire_id');
  let catalog: Record<number, QuestionMetadata> = {};
  let questionnaire_type_from_backend: string | null = null; // <── 新增

  // 3.1 後端題目目錄
  let qApi: string | null = null;
  const q_key = version_id || questionnaireId; // <-- 優先用 version_id

  if (qApiTemplate && q_key) {
    // <-- 更新
    qApi = qApiTemplate.replace('{qid}', String(q_key)); // <-- 更新
    try {
      const r = await axios.get(qApi, { timeout: 30000 });
      if (r.data) {
        const q_data = r.data;
        const data_block = q_data.data || {};

        // ⭐ 這裡直接取回「建模前 / 建模中 / 建模後」
        const group = data_block.group || {};
        questionnaire_type_from_backend = group.name || null;

        // ⭐ 題目清單也在這裡
        const qList = data_block.questions || [];

        for (const q of qList) {
          if (q.id) catalog[Number(q.id)] = q;
        }
      }
    } catch (e: any) {
      if (axios.isAxiosError(e) && e.response) {
        console.warn(
          `[WARN] Q API HTTP ${e.response.status}: ${JSON.stringify(
            e.response.data,
          )}`,
        );
      } else {
        console.warn(`[WARN] 取得題目目錄失敗：${(e as Error).message}`);
      }
    }
  }
  // ******** ⭐ 邏輯更新 (來自 Python 變更) END ********

  // 3.2 本地快取
  if (Object.keys(catalog).length === 0) {
    catalog = loadQuestionCatalog(questionCatalogPath);
  }

  // 3.3 備援對應
  const qmap = loadQidAxisMap(qidAxisMapPath);

  // 3.4 存快照
  if (Object.keys(catalog).length > 0 && saveCatalogSnapshot) {
    const ts = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .slice(0, 19)
      .replace('T', '_');
    const snapPath = path.join(
      outDir,
      `questionnaire_${questionnaireId || 'unknown'}_${ts}.snapshot.json`,
    );
    try {
      const snap = {
        questionnaire_id: questionnaireId,
        from_api: qApi,
        generated_at: ts,
        questions: Object.values(catalog),
      };
      fs.writeFileSync(snapPath, JSON.stringify(snap, null, 2), 'utf-8');
      console.log(`[OK] 題目目錄快照已存：${snapPath}`);
    } catch (e: any) {
      console.warn(`[WARN] 快照寫入失敗：${(e as Error).message}`);
    }
  }

  // 4) 合併 metadata
  answers = attachMetadata(answers, catalog, qmap);

  if (answers.length === 0) {
    console.warn(
      '[WARN] 無法在 API 回應中找到 answers 陣列，請確認欄位名稱與結構。',
    );
  }

  // 5) 準備 LLM 所需的 per-axis data
  let llm_data_by_axis: Record<string, LLMData> | null = null;
  let _llm_call: LLMCallFn | undefined = undefined;
  if (withLlm) {
    llm_data_by_axis = buildLlmDataFromAnswers(answers);
    _llm_call = llmCall || callLlmScout;
  }

  // 6) 計分 & 產出
  let integrationArgs: any = {
    outDir,
    title,
    llm_data_by_axis,
    llm_call: _llm_call,
    questionnaire_type: questionnaire_type_from_backend, // <-- ⭐ 傳入 (來自 Python 變更)
  };

  if (mode === 'answers') {
    integrationArgs.answersByAxis = toAnswersByAxis(answers);
  } else {
    integrationArgs.countsByAxis = toCountsByAxis(
      answers,
      likertYesMin,
      likertNoMax,
    );
  }

  const { jsonPath, report } = await integrateAndGenerateReport(integrationArgs);

  // 7) 讀回報告 dict
  const reportData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  return [jsonPath, reportData];
}

// ============================================================
//  八、CLI 入口
// ============================================================

async function main() {
  // +++ 【新增】確保 CLI 執行時載入設定 +++
  configDotenv();
  loadPromptConfig();

  const program = new Command();

  program
    .version('1.0.0')
    .requiredOption('--response-id <id>', '雲端或本機後端的 Response ID')
    .option(
      '--api <template>',
      '回應 API 模板，必須包含 {id}',
      'http://localhost:3001/api/response/id/{id}',
    )
    .option(
      '--mode <type>',
      '以二元統計 (counts) 或逐題答案 (answers) 計分',
      'counts',
    )
    .option('--out-dir <dir>', '輸出資料夾', 'outputs')
    .option(
      '--title <title>',
      '報告標題',
      'TAI Radar (Integrated Final Report)',
    )
    .option(
      '--with-llm',
      '同時生成各軸 LLM 建議 (需 .env 和 Prompt.json)',
      false,
    )
    .option(
      '--q-api-template <template>',
      '後端題目目錄 API 模板，如 http://.../api/questionnaire/{qid}/questions',
    )
    .option('--question-catalog <path>', '本地快取問題目錄 JSON')
    .option('--qid-axis-map <path>', '備援 {questionId: AxisName} JSON')
    .option(
      '--likert-yes-min <num>',
      'Likert 視為 yes 的下限 (含)',
      (v: string) => parseInt(v, 10),
      4,
    )
    .option(
      '--likert-no-max <num>',
      'Likert 視為 no 的上限 (含)',
      (v: string) => parseInt(v, 10),
      2,
    )
    .option(
      '--save-catalog-snapshot',
      '將後端題目目錄另存快照到 out_dir',
      false,
    );

  program.parse(process.argv);
  const options = program.opts();

  // 若要啟用 LLM，先載入 Prompt 設定
  // if (options.withLlm) { // <-- 舊的呼叫位置 (已移到頂層)
  //   loadPromptConfig();
  // }

  try {
    const [jsonPath, report] = await generateReportForResponse({
      responseId: options.responseId,
      apiTemplate: options.api,
      mode: options.mode === 'answers' ? 'answers' : 'counts',
      outDir: options.outDir,
      title: options.title,
      qApiTemplate: options.qApiTemplate, // commander.js 會自動將 'q-api-template' 轉為 'qApiTemplate'
      questionCatalogPath: options.questionCatalog,
      qidAxisMapPath: options.qidAxisMap,
      likertYesMin: options.likertYesMin,
      likertNoMax: options.likertNoMax,
      saveCatalogSnapshot: options.saveCatalogSnapshot,
      withLlm: options.withLlm,
    });

    console.log('\n=== CLI 報告已完成 ===');
    console.log(`JSON 報告：${jsonPath}`);
    console.log(`雷達圖：${report.meta.radar_image_path}`);
  } catch (e: any) {
    console.error('\n[ERROR] 報告生成失敗：');
    console.error(e.message);
    process.exit(1);
  }
}

// 執行主函數
// 檢查是否是作為主腳本執行
if (require.main === module) {
  main();
}

// ============================================================
//  九、+++ 新增的匯出函式 (給 Controller 呼叫) +++
// ============================================================

/**
 * 專門給 Controller 呼叫的函式，用於生成「單一的」總體分析文字。
 * 它會重複使用您檔案中已有的 callLlmScout 函式。
 * @param overallScore (預期 0-100)
 * @param radarData (預期 0-100)
 * @returns
 */
export async function generateOverallAnalysis(
  overallScore: number,
  radarData: Record<string, number>,
): Promise<string> {
  // +++ 【新增】確保 API 呼叫時載入設定 +++
  configDotenv();
  loadPromptConfig();

  // 1. 建立高品質的 Prompt
  // (使用我們上次討論的「角色扮演 + 結構化任務」Prompt)
  // (分數範圍假設為 0-100)
  const prompt = `
你是一位專業的 AI 治理與可信賴 AI (Trustworthy AI) 分析師。

我剛剛完成了一次 AI 系統的評估，以下是整體的總分，以及各個 TAI 核心面向的平均分數（分數範圍 0-100）：

[輸入數據]
整體總分 (Overall Score): ${overallScore.toFixed(2)}
各面向分數 (Radar Data):
${JSON.stringify(radarData, null, 2)}

[你的任務]
請根據上述數據，撰寫一份專業的分析報告（至少 150 字）。報告必須包含以下幾個部分：

1.  **整體總結 (Overall Summary):**
    * 首先提到整體得分，並對系統的總體可信度給出一個初步的定性評價（例如：尚待加強、基礎穩固、表現良好等）。

2.  **強項分析 (Strengths Analysis):**
    * 找出分數最高的面向。
    * 解釋這個高分代表的**具體意義**。

3.  **風險與弱項分析 (Weakness & Risk Analysis):**
    * 找出分數最低的面向。
    * 分析這個低分可能帶來的**具體風險**或**負面影響**。

4.  **具體行動建議 (Actionable Recommendations):**
    * 針對分數最低的 1-2 個面向，提供 2-3 個**具體且可執行**的改善建議。
    * 建議應具體，而不只是「請加強...」。

請使用專業、具建設性的語氣。
  `;

  // 2. 準備 System Prompt
  // (使用您 reportLLM.ts 載入的 PROMPT_SYSTEM，如果為空則使用預設值)
  const systemPrompt =
    PROMPT_SYSTEM || '你是一位專業、嚴謹的 AI 治理與可信賴 AI 分析師。';

  // 3. 呼叫 LLM (重複使用您已有的函式)
  // 注意：callLlmScout 預設模型是 "meta-llama/llama-4-scout:free"
  // 建議使用更強的模型 (如 gpt-4-turbo 或 claude-3-opus) 來取得最好的分析品質
  const result = await callLlmScout(
    systemPrompt,
    prompt,
    // "gpt-4-turbo", // (可選) 覆寫模型
  );

  // 4. 回傳結果
  if (result.error) {
    console.error(`[generateOverallAnalysis] LLM Error: ${result.error}`);
    // 即使 LLM 失敗，也回傳一個基礎模板
    const sortedScores = Object.entries(radarData).sort((a, b) => a[1] - b[1]);
    const lowest = sortedScores[0] || ['N/A', 0];
    const highest = sortedScores[sortedScores.length - 1] || ['N/A', 0];
    return `AI 分析生成失敗。整體分數 ${overallScore.toFixed(2)}。表現最佳：${
      highest[0]
    } (${highest[1]})，建議加強：${lowest[0]} (${lowest[1]})。`;
  }

  return result.content || 'LLM 返回了空的分析內容。';
}