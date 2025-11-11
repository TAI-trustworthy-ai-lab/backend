import { PrismaClient, TAIIndicator } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * 建立新 Project
 */
export const createProject = async (data: {
  userId: number;
  name: string;
  description?: string;
}) => {
  // 檢查上限
  const count = await prisma.project.count({ where: { userId: data.userId } });
  if (count >= 5) {
    throw new Error('You can only have up to 5 projects. Please delete an old one first.');
  }

  // 創建新專案
  return prisma.project.create({
    data: {
      userId: data.userId,
      name: data.name,
      description: data.description ?? null,
    },
  });
};

/**
 * 查詢使用者所有 Project
 */
export const getProjectsByUser = async (userId: number) => {
  return prisma.project.findMany({
    where: { userId },
    include: { taiOrders: true },
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * 查單一 Project
 */
export const getProjectById = async (id: number) => {
  return prisma.project.findUnique({
    where: { id },
    include: { taiOrders: true, responses: true },
  });
};

export const getProjectByName = async (userId: number, name: string) => {
  const project = await prisma.project.findFirst({
    where: { userId, name },
    include: { taiOrders: true },
  });
  if (!project) throw new Error('Project not found');
  return project;
};

/**
 * 查詢 Project 的 TAI 排序
 */
export const getProjectTAI = async (projectId: number) => {
  return prisma.projectTAIPriority.findMany({
    where: { projectId },
    orderBy: { rank: 'asc' },
  });
};

/**
 * 更新 Project 的 TAI 排序
 * （先刪除舊資料再重建新的排序）
 */
export const updateProjectTAI = async (
  projectId: number,
  priorities: { indicator: TAIIndicator; rank: number; weight?: number }[],
) => {
  await prisma.projectTAIPriority.deleteMany({ where: { projectId } });
  const created = await prisma.projectTAIPriority.createMany({
    data: priorities.map((p) => ({
      projectId,
      indicator: p.indicator,
      rank: p.rank,
      weight: p.weight ?? null,
    })),
  });
  return { message: 'TAI priorities updated successfully', count: created.count };
};

// projectService.ts
export const deleteProject = async (id: number) => {
  // 若希望連 responses 一起刪，可開 transaction
  return prisma.$transaction(async (tx) => {
    await tx.projectTAIPriority.deleteMany({ where: { projectId: id } });
    await tx.response.deleteMany({ where: { projectId: id } });
    const deleted = await tx.project.delete({ where: { id } });
    return { message: `Project '${deleted.name}' deleted successfully`, deletedId: id };
  });
};
