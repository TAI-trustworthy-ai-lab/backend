import bcrypt from 'bcrypt';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
};

export const comparePasswords = async (dbPassword: string, incomingPassword: string): Promise<boolean> => {
  return await bcrypt.compare(dbPassword, incomingPassword);
};
