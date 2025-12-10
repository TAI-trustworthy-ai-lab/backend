// src/services/responseService.ts
import { PrismaClient, QuestionType, Question } from "@prisma/client";
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

// 前端 PATCH /response/:id 時每一筆 answer 的型別
export type AnswerPatchInput = {
  questionId: number;
  value?: number | null;
  optionId?: number | null;
  optionIds?: number[] | null; 
  textValue?: string | null;
};

/**
 * 更新一份 Response 的答案
 * - 支援 SCALE / SINGLE_CHOICE / MULTIPLE_CHOICE / TEXT
 * - MULTIPLE_CHOICE: 用 optionIds 表示「目前勾選的全部選項」，會做上線/下線
 */
export async function updateResponse(
  responseId: number,
  answers: AnswerPatchInput[]
) {
  // 1) 先查出這份 response + 對應 questionnaire 的所有題目（不用 transaction）
  const response = await prisma.response.findUnique({
    where: { id: responseId },
    include: {
      version: {
        include: { questions: true },
      },
    },
  });

  if (!response) {
    throw new Error("Response not found");
  }

  // 建立 questionId -> Question 的 map，讓後面快速查
  const questionMap = new Map<number, Question>();
  for (const q of response.version.questions) {
    questionMap.set(q.id, q as Question);
  }

  // 2) 逐題處理，每題一個短 transaction
  for (const input of answers) {
    const { questionId, value, optionId, optionIds, textValue } = input;

    if (!questionId || typeof questionId !== "number") {
      throw new Error("Each answer must have a valid questionId");
    }

    const question = questionMap.get(questionId);
    if (!question) {
      throw new Error(
        `Question ${questionId} does not belong to this response's questionnaire version`
      );
    }

    //每一題獨立 transaction
    await prisma.$transaction(async (tx) => {
      switch (question.type) {
        // ======================
        // 1) SCALE 題：一題一筆，用 value
        // ======================
        case QuestionType.SCALE: {
          if (value === null || value === undefined) {
            // 視為清空這題答案
            await tx.answer.deleteMany({
              where: { responseId, questionId },
            });
          } else {
            const numericValue = Number(value);
            if (isNaN(numericValue)) {
              throw new Error(`Invalid value for SCALE question ${questionId}`);
            }

            // 保證這題只留一筆 Answer
            await tx.answer.deleteMany({
              where: { responseId, questionId },
            });

            await tx.answer.create({
              data: {
                responseId,
                questionId,
                value: numericValue,
                optionId: null,
                textValue: null,
              },
            });
          }
          break;
        }

        // ======================
        // 2) SINGLE_CHOICE：一題一筆，用 optionId
        // ======================
        case QuestionType.SINGLE_CHOICE: {
          if (!optionId) {
            // 沒傳 / null -> 清空這題答案
            await tx.answer.deleteMany({
              where: { responseId, questionId },
            });
          } else {
            // 確認 option 屬於該題
            const opt = await tx.questionOption.findUnique({
              where: { id: optionId },
            });

            if (!opt || opt.questionId !== questionId) {
              throw new Error(
                `Option ${optionId} does not belong to question ${questionId}`
              );
            }

            await tx.answer.deleteMany({
              where: { responseId, questionId },
            });

            await tx.answer.create({
              data: {
                responseId,
                questionId,
                optionId,
                value: opt.value ?? null,
                textValue: null,
              },
            });
          }
          break;
        }

        // ======================
        // 3) MULTIPLE_CHOICE：用 optionIds，支援上線/下線
        // ======================
        case QuestionType.MULTIPLE_CHOICE: {
          const ids = (optionIds ?? []).filter(
            (id): id is number => typeof id === "number"
          );

          // 將當前 DB 中這題的答案查出來
          const existingAnswers = await tx.answer.findMany({
            where: { responseId, questionId },
          });

          const existingOptionIdSet = new Set(
            existingAnswers
              .map((a) => a.optionId)
              .filter((id): id is number => typeof id === "number")
          );

          const targetOptionIdSet = new Set(ids);

          // 3-1) 驗證：所有 target optionIds 都必須是這題的選項
          if (targetOptionIdSet.size > 0) {
            const options = await tx.questionOption.findMany({
              where: {
                id: { in: Array.from(targetOptionIdSet) },
              },
            });

            const invalidOptionIds = Array.from(targetOptionIdSet).filter(
              (id) => !options.some((opt) => opt.id === id && opt.questionId === questionId)
            );

            if (invalidOptionIds.length > 0) {
              throw new Error(
                `Some optionIds do not belong to question ${questionId}: [${invalidOptionIds.join(
                  ", "
                )}]`
              );
            }
          }

          // 3-2) 下線：DB 有，但不在新的選擇中 -> deleteMany
          const optionIdsToRemove = Array.from(existingOptionIdSet).filter(
            (id) => !targetOptionIdSet.has(id)
          );

          if (optionIdsToRemove.length > 0) {
            await tx.answer.deleteMany({
              where: {
                responseId,
                questionId,
                optionId: { in: optionIdsToRemove },
              },
            });
          }

          // 3-3) 上線：新的選擇裡有，但 DB 裡沒有 -> createMany
          const optionIdsToAdd = Array.from(targetOptionIdSet).filter(
            (id) => !existingOptionIdSet.has(id)
          );

          if (optionIdsToAdd.length > 0) {
            await tx.answer.createMany({
              data: optionIdsToAdd.map((oid) => ({
                responseId,
                questionId,
                optionId: oid,
                value: null,
                textValue: null,
              })),
            });
          }

          // 若 optionIds 是空陣列 => 全部 Answer 被刪光，表示「目前沒勾任何選項」
          break;
        }

        // ======================
        // 4) TEXT 題：一題一筆，用 textValue
        // ======================
        case QuestionType.TEXT: {
          const finalText = textValue ?? "";

          if (finalText.trim() === "") {
            await tx.answer.deleteMany({
              where: { responseId, questionId },
            });
          } else {
            await tx.answer.deleteMany({
              where: { responseId, questionId },
            });

            await tx.answer.create({
              data: {
                responseId,
                questionId,
                textValue: finalText,
                value: null,
                optionId: null,
              },
            });
          }
          break;
        }

        default: {
          throw new Error(
            `Unsupported QuestionType ${question.type} for question ${questionId}`
          );
        }
      }
    }); // ← 這一題的 transaction 結束（成功就 commit，錯就 rollback 然後整個 updateResponse throw）
  }

  // 3) 全部題目處理完後，再查一次最新的 response 回傳給前端
  const updated = await prisma.response.findUnique({
    where: { id: responseId },
    include: {
      answers: {
        include: {
          question: true,
          option: { select: { id: true, text: true, value: true } },
        },
      },
      project: true,
      version: true,
    },
  });

  if (!updated) {
    throw new Error("Response disappeared after update (unexpected)");
  }

  return updated;
}

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
