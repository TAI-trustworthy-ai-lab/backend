import jwt, { SignOptions, Secret } from 'jsonwebtoken';

interface TPayload { id: string }

export const generateToken = (payload: TPayload, expiresIn: string | number): string => {
  return jwt.sign(payload, process.env.JWT_SECRET as Secret, {
    expiresIn: expiresIn as any
  });
};

export const verifyToken = (token: string): TPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as TPayload;
};
