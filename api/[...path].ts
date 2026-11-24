import type { Request, Response } from 'express';
import { createApp } from '../server.ts';

let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    res.status(503).json({
      error: 'Configure POSTGRES_URL or DATABASE_URL in the Vercel project settings.',
    });
    return;
  }

  try {
    if (!appPromise) {
      appPromise = createApp();
    }
    const app = await appPromise;
    if (req.url && !req.url.startsWith('/api/')) {
      req.url = `/api/${req.url.replace(/^\/+/, '')}`;
    }
    app(req, res);
  } catch (error) {
    console.error('Failed to initialize the Vercel API handler.', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Unable to initialize the league API.' });
    }
  }
}
