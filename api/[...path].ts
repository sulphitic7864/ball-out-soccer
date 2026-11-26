import type { Request, Response } from 'express';
import { createApp } from '../server.ts';

let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: Request, res: Response): Promise<void> {
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
