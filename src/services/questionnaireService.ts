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
  }[];
}

/**
 * createQuestionnaire:
 * if no existing group, create one
 * if existing, create new version under that group
 * 建立一個新的問卷版本：
 * - 如果 group 不存在就建立 (ex: 第一次建立 "建模前")
 * - 如果已存在，就在該 group 底下新增下一版 versionNumber
 */
export const createQuestionnaire = async (data: CreateQuestionnairePayload) => {
  const { groupName, title, description, questions } = data;

  // 找或建 group
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

  // find latest version
  // 找目前最大版號
  const lastVersion = await prisma.questionnaireVersion.findFirst({
    where: { groupId: group.id },
    orderBy: { versionNumber: 'desc' },
  });

  const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

  // create new version with questions
  // 建立新版本 + 題目
  const newVersion = await prisma.questionnaireVersion.create({
    data: {
      groupId: group.id,
      versionNumber: nextVersionNumber,
      title,
      description,
      questions: {
        create: questions.map((q) => ({
          text: q.text,
          category: q.category as any,
          order: q.order,
        })),
      },
    },
    include: {
      group: true,
      questions: true,
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
      questions: true,
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
