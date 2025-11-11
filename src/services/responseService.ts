// src/services/responseService.ts
import { PrismaClient, QuestionType } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * 建立一份新的問卷回覆（針對特定版本 + 專案）
 * - 自動根據 QuestionType 過濾無效欄位
 * - 提供更友善的錯誤回報格式
 * - MULTIPLE_CHOICE 支援一次多選 optionIds[]
 */
/**
 * Create a new questionnaire response (for a specific version + project)
 * - Cleans and validates answers automatically based on QuestionType
 * - Returns clear English error messages
 * - Supports MULTIPLE_CHOICE with optionIds[]
 */
export const createResponse = async (data: {
  userId: number;
  projectId: number;
  versionId: number;
  answers: {
    questionId: number;
    optionId?: number;
    optionIds?: number[];
    value?: number;
    textValue?: string;
  }[];
}) => {
  // 基本欄位檢查
  // basic field validation
  if (!data.userId || !data.projectId || !data.versionId)
    throw new Error('userId, projectId, versionId 為必填欄位');
  if (!Array.isArray(data.answers) || data.answers.length === 0)
    throw new Error('answers 陣列不可為空');

  // 取得題目基本資料
  // fetch question details
  const questionIds = [...new Set(data.answers.map(a => a.questionId))];
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, type: true, required: true },
  });
  const questionMap = new Map(questions.map(q => [q.id, q]));

  // 取得所有選項（若有提供）
  // fetch all options (if provided)
  const allOptionIds = new Set<number>();
  for (const a of data.answers) {
    if (a.optionId) allOptionIds.add(a.optionId);
    if (Array.isArray(a.optionIds)) a.optionIds.forEach(id => allOptionIds.add(id));
  }
  const options = await prisma.questionOption.findMany({
    where: { id: { in: Array.from(allOptionIds) } },
    select: { id: true, questionId: true, value: true },
  });
  const optionMap = new Map(options.map(o => [o.id, o]));

  // 清理 + 驗證答案
  // cleanse + validate answers
  const sanitizedAnswers: {
    questionId: number;
    optionId?: number | null;
    value?: number | null;
    textValue?: string | null;
  }[] = [];

  const errors: { questionId: number; error: string }[] = [];

  for (const ans of data.answers) {
    const q = questionMap.get(ans.questionId);
    if (!q) {
      errors.push({ questionId: ans.questionId, error: 'Question does not exist' });
      continue;
    }

    try {
      switch (q.type) {
        case QuestionType.SCALE: {
          if (q.required && (ans.value === undefined || ans.value === null))
            throw new Error('This SCALE question requires a numeric value.');
          sanitizedAnswers.push({
            questionId: ans.questionId,
            value: ans.value ?? null,
            optionId: null,
            textValue: null,
          });
          break;
        }

        case QuestionType.SINGLE_CHOICE: {
          if (!ans.optionId)
            throw new Error('This SINGLE_CHOICE question requires an optionId.');
          const opt = optionMap.get(ans.optionId);
          if (!opt)
            throw new Error(`optionId ${ans.optionId} does not exist`);
          if (opt.questionId !== ans.questionId)
            throw new Error(`optionId ${ans.optionId} does not belong to this question.`);

          sanitizedAnswers.push({
            questionId: ans.questionId,
            optionId: opt.id,
            value: opt.value ?? null,
            textValue: null,
          });
          break;
        }

        case QuestionType.MULTIPLE_CHOICE: {
          const optionIds = ans.optionIds ?? (ans.optionId ? [ans.optionId] : []);
          if (optionIds.length === 0)
            throw new Error('This MULTIPLE_CHOICE question requires at least one optionId.');

          for (const oid of optionIds) {
            const opt = optionMap.get(oid);
            if (!opt)
              throw new Error(`Option ${oid} does not exist.`);
            if (opt.questionId !== ans.questionId)
              throw new Error(`Option ${oid} does not belong to this question.`);

            sanitizedAnswers.push({
              questionId: ans.questionId,
              optionId: opt.id,
              value: opt.value ?? null,
              textValue: null,
            });
          }
          break;
        }

        case QuestionType.TEXT: {
          const text = ans.textValue?.trim() ?? '';
          if (q.required && !text)
            throw new Error('This TEXT question requires a non-empty textValue.');
          sanitizedAnswers.push({
            questionId: ans.questionId,
            optionId: null,
            value: null,
            textValue: text || null,
          });
          break;
        }

        default:
          throw new Error(`Unsupported question type: ${q.type}`);
      }
    } catch (err) {
      errors.push({ questionId: ans.questionId, error: (err as Error).message });
    }
  }

  // 若有任何錯誤，回傳錯誤清單（不進資料庫）
  // if any errors, return all errors without inserting to DB
  if (errors.length > 0) {
    const validationError = new Error('VALIDATION_ERRORS');
    (validationError as any).validationErrors = errors;
    throw validationError;
  }

  // 寫入資料庫
  // insert into database
  const response = await prisma.response.create({
    data: {
      userId: data.userId,
      projectId: data.projectId,
      versionId: data.versionId,
      answers: { create: sanitizedAnswers },
    },
    include: {
      answers: true,
      user: true,
      project: true,
      version: { include: { group: true } },
    },
  });

  return response;
};

/**
 * 取得指定問卷版本的所有回覆
 * get all responses for a specific questionnaire version
 */
export const getResponsesByVersionId = async (versionId: number) => {
  return prisma.response.findMany({
    where: { versionId },
    include: {
      answers: true,
      user: true,
      project: true,
      version: { include: { group: true } },
    },
  });
};

export const getResponseById = async (id: number) => {
  return prisma.response.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      version: { select: { id: true, title: true } },
      answers: {
        include: {
          question: { select: { id: true, text: true, category: true, type: true } },
          option: { select: { id: true, text: true, value: true } },
        },
      },
    },
  });
};

/**
 * 取得某使用者的所有作答
 */
export const getResponsesByUserId = async (userId: number) => {
  return prisma.response.findMany({
    where: { userId },
    orderBy: { submittedAt: 'desc' },
    include: {
      project: { select: { id: true, name: true } },
      version: { select: { id: true, title: true } },
    },
  });
};

/**
 * 取得某專案的所有作答
 */
export const getResponsesByProjectId = async (projectId: number) => {
  return prisma.response.findMany({
    where: { projectId },
    orderBy: { submittedAt: 'desc' },
    include: {
      user: { select: { id: true, name: true } },
      version: { select: { id: true, title: true } },
    },
  });
};

/**
 * 更新作答內容（答案）
 */
export const updateResponse = async (
  id: number,
  answers: {
    questionId: number;
    value?: number;
    textValue?: string;
    optionId?: number;
  }[]
) => {
  // 先刪除舊的 answers，再重新建立
  await prisma.answer.deleteMany({ where: { responseId: id } });

  // 重新寫入新答案
  const updated = await prisma.response.update({
    where: { id },
    data: {
      answers: { create: answers },
      submittedAt: new Date(),
    },
    include: {
      user: true,
      project: true,
      version: true,
      answers: true,
    },
  });

  return updated;
};

/**
 * 刪除一份作答
 */
export const deleteResponse = async (id: number) => {
  return prisma.response.delete({
    where: { id },
    include: {
      user: true,
      project: true,
      version: true,
    },
  });
};
