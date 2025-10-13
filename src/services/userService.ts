import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const UserService = {
  createUser: async (data: { name: string, email: string, hashedPassword: string }) => {
    return prisma.user.create({ data });
  },

  findUserByEmail: async (email: string) => {
    return prisma.user.findUnique({ where: { email } });
  },

  findUserByName: async (name: string) => {
    return prisma.user.findUnique({ where: { name } });
  },

  findUserById: async (id: number) => {
    return prisma.user.findUnique({ where: { id } });
  },

  updateUser: async (id: number, data: { name: string }) => {
    return prisma.user.update({ where: { id }, data });
  },

  deleteUser: async (id: number) => {
    return prisma.user.delete({ where: { id } });
  },

  findAllUsers: async () => {
    return prisma.user.findMany();
  },
};
