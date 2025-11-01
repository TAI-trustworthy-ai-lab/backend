// src/services/responseService.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createResponse = async (data: {
  userId: number;
  questionnaireId: number;
  answers: { questionId: number; value: number }[];
}) => {
  return prisma.response.create({
    data: {
      userId: data.userId,
      questionnaireId: data.questionnaireId,
      answers: {
        create: data.answers.map(a => ({
          questionId: a.questionId,
          value: a.value,
        })),
      },
    },
    include: { answers: true },
  });
};

export const getResponsesByQuestionnaireId = async (questionnaireId: number) => {
  return prisma.response.findMany({
    where: { questionnaireId },
    include: { answers: true, user: true },
  });
};
