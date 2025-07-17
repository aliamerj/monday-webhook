import { Request, Response } from 'express';
import { tryCatch } from '../libs/try-catch';
import { secureStorage } from '../sdk';

export const handleAuthorization = async (_: Request, res: Response) => {
  const storedValue = await secureStorage.get('user_access_token');
  if (storedValue) return res.sendStatus(200)

  const scopes = [
    'boards:read',
    'boards:write',
    'users:read',
    'webhooks:write',
    'notifications:write'
  ].join(' ');

  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID!,
    redirect_uri: process.env.REDIRECT_URI!,
    scope: scopes,
    state: 'optional-anti-csrf-token'
  });

  return res.redirect(`https://auth.monday.com/oauth2/authorize?${params.toString()}`);
}

export const handleOauth = async (req: Request, res: Response) => {

  const { code, state } = req.query
  if (!code || !state) return res.status(400).send('Missing code');

  const { data: tokenResponse, error } = await tryCatch(fetch("https://auth.monday.com/oauth2/token", {
    method: 'POST',
    body: JSON.stringify({
      client_id: process.env.CLIENT_ID!,
      client_secret: process.env.CLIENT_SECRET,
      code,
      redirect_uri: process.env.REDIRECT_URI
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  }
  ))
  if (error || !tokenResponse.ok) {
    return res.status(500).send('Token exchange failed');
  }

  const data = await tokenResponse.json();

  await secureStorage.set('user_access_token', data.access_token);
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

  return res.redirect(CLIENT_URL)
}
