import { User } from '@prisma/client';

export interface CreateUserRequest {
    name: string;
    email: string;
    password: string;
}

export interface UpdateUserRequest {
    name?: string;
    email?: string;
}

export type UserResponse = Omit<User, 'hashedPassword' | 'salt'>;
