import { Request, Response, NextFunction } from 'express';
import { monday, secureStorage } from '../sdk';

export async function withMondayAuth(_: Request, res: Response, next: NextFunction) {
  const storedToken = await secureStorage.get('user_access_token');
  if (!storedToken) return res.sendStatus(401)
  monday.setToken(storedToken as string)
  next()
}
