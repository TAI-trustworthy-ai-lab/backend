import { z } from 'zod';

// _____________  User Schema  Login  _____________

const userBaseSchema = {
  name: z.string().min(1, { message: 'username must be at least 1 characters long' }).max(50, {
    message: 'username cannot be longer than 50 characters',
  }),
  password: z.string().min(1, { message: 'password must be at least 1 characters long' }).max(50, {
    message: 'password cannot be longer than 50 characters',
  }),
};

export const userSchema = z.object(userBaseSchema);

// _____________  User Update Schema   _____________

export const userUpdateSchema = z.object({
  ...userBaseSchema,
  fullName: z.string().min(1, { message: 'fullName must be at least 1 characters long' }).max(50, {
    message: 'fullName cannot be longer than 50 characters',
  }),
  email: z.string().email({ message: 'Invalid email address' }),
});

// _____________  Export Types   _____________

export type TUserSchema = z.infer<typeof userSchema>;
export type TuserUpdateSchema = z.infer<typeof userUpdateSchema>;