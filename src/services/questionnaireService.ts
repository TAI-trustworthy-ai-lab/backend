// src/services/questionnaireService.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createQuestionnaire = async (data: {
  title: string;
  description?: string;
  questions: { text: string; category: string; order: number }[];
}) => {
  return prisma.questionnaire.create({
    data: {
      title: data.title,
      description: data.description,
      questions: {
        create: data.questions.map(q => ({
          text: q.text,
          category: q.category,
          order: q.order,
        })),
      },
    },
    include: { questions: true },
  });
};

export const getQuestionnaireById = async (id: number) => {
  return prisma.questionnaire.findUnique({
    where: { id },
    include: { questions: true },
  });
};
