import app from '../server/app';

export default async function handler(req: any, res: any) {
  try {
    return (app as any)(req, res);
  } catch (err: any) {
    console.error('[Vercel Serverless Function Error]', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: `Serverless Function Error: ${err?.message || 'Unknown invocation error'}`,
      });
    }
  }
}

export { app };
