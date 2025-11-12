// src/services/questionnaireService.ts
import prisma from '../utils/prismaClient'; // 依你專案實際路徑調整

// 建立問卷版本用的型別 (Body)
// using for creating questionnaire version
interface CreateQuestionnairePayload {
  groupName: string; // "建模前" / "建模中" / "建模後"
  title: string;
  description?: string;
  questions: {
    text: string;
    category: string; // TAIIndicator
    order: number;
    type?: string; // 新增題型
    options?: {
      text: string;
      value?: number;
      order: number;
    }[];
  }[];
}

export const createQuestionnaire = async (data: CreateQuestionnairePayload) => {
  const { groupName, title, description, questions } = data;

  // 先找或建立 group
  let group = await prisma.questionnaireGroup.findUnique({
    where: { name: groupName },
  });

  if (!group) {
    group = await prisma.questionnaireGroup.create({
      data: {
        name: groupName,
        description: `${groupName} 問卷`,
      },
    });
  }

  // 找目前該 group 的最大 versionNumber
  const lastVersion = await prisma.questionnaireVersion.findFirst({
    where: { groupId: group.id },
    orderBy: { versionNumber: 'desc' },
  });

  const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

  // 建立新 version 與對應題目 + 選項
  const newVersion = await prisma.questionnaireVersion.create({
    data: {
      groupId: group.id,
      versionNumber: nextVersionNumber,
      title,
      description,
      questions: {
        create: questions.map((q) => {
          const type = (q.type ?? 'SCALE').toUpperCase();

          // 防呆邏輯
          if ((type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && !q.options) {
            throw new Error(`Question "${q.text}" requires options for type ${type}`);
          }
          if (type === 'TEXT' && q.options && q.options.length > 0) {
            throw new Error(`Question "${q.text}" should not have options for TEXT type`);
          }

          // 建立題目與選項
          return {
            text: q.text,
            category: q.category as any,
            order: q.order,
            type: type as any,
            options:
              q.options && q.options.length > 0
                ? {
                    create: q.options.map((opt) => ({
                      text: opt.text,
                      value: opt.value,
                      order: opt.order,
                    })),
                  }
                : undefined,
          };
        }),
      },
    },
    include: {
      group: true,
      questions: {
        include: { options: true },
      },
    },
  });

  return newVersion;
};

/**
 * get the questionnaire version by ID
 * 取得指定版本 ID 的問卷內容（含題目）
 */
export const getQuestionnaireVersionById = async (id: number) => {
  return prisma.questionnaireVersion.findUnique({
    where: { id },
    include: {
      group: true,
      questions: {
        include: { options: true }, 
      },
    },
  });
};

/**
 * get all questionnaire groups with their latest version
 * 取得所有 Group + 各自「最新版本」（前端登入後階段選擇頁用）
 */
export const getLatestQuestionnaireGroups = async () => {
  return prisma.questionnaireGroup.findMany({
    include: {
      versions: {
        where: { isActive: true },
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  });
};

// 查詢參數型別
interface ListQuestionnairesParams {
  groupName?: string;        // 依 group 名稱過濾（建模前/建模中/建模後）
  isActive?: boolean;        // 過濾版本啟用狀態
  includeQuestions?: boolean;// 是否包含題目與選項
  page?: number;             // 第幾頁（預設 1）
  pageSize?: number;         // 每頁筆數（預設 20）
}

/**
 * 取得所有問卷版本（可選擇是否帶題目與選項），支援篩選與分頁
 */
export const getAllQuestionnaireVersions = async (params: ListQuestionnairesParams) => {
  const {
    groupName,
    isActive,
    includeQuestions = true,
    page = 1,
    pageSize = 20,
  } = params;

  const where: any = {};
  if (typeof isActive === 'boolean') where.isActive = isActive;
  if (groupName) where.group = { name: groupName };

  const skip = (Math.max(page, 1) - 1) * Math.max(pageSize, 1);
  const take = Math.max(pageSize, 1);

  const [total, items] = await Promise.all([
    prisma.questionnaireVersion.count({ where }),
    prisma.questionnaireVersion.findMany({
      where,
      orderBy: [{ groupId: 'asc' }, { versionNumber: 'desc' }],
      include: {
        group: true,
        questions: includeQuestions
          ? { orderBy: { order: 'asc' }, include: { options: true } }
          : false,
      },
      skip,
      take,
    }),
  ]);

  return {
    items,
    pagination: {
      page,
      pageSize: take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  };
};
