import type { Request, Response } from 'express';
import { createApp } from '../server';

let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: Request, res: Response) {
  appPromise ||= createApp();
  const app = await appPromise;
  return app(req, res);
}