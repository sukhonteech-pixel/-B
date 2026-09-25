import app, { setBroadcaster } from './server/app';
import http from 'http';
import path from 'path';
import express from 'express';

const PORT = 3000;
const server = http.createServer(app);
const connectedClients = new Set<any>();

setBroadcaster((event: string, payload: any) => {
  const message = JSON.stringify({ event, payload });
  connectedClients.forEach((client) => {
    if (client.readyState === 1) { // 1 === WebSocket.OPEN
      try {
        client.send(message);
      } catch (err) {
        console.error('Error broadcasting WS message:', err);
      }
    }
  });
});

async function start() {
  try {
    const { WebSocketServer } = await import('ws');
    const wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws) => {
      connectedClients.add(ws);
      ws.send(
        JSON.stringify({
          event: 'connected',
          payload: {
            timestamp: new Date().toISOString(),
            system: 'PEAK PROPERTY DATA',
          },
        })
      );

      ws.on('close', () => {
        connectedClients.delete(ws);
      });
    });
  } catch (wsErr) {
    console.warn('[WebSocket] Skipped or failed initializing WebSocket server:', wsErr);
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[PEAK Property Data Server] Running on http://0.0.0.0:${PORT}`);
  });
}

const isServerless = !!process.env.VERCEL || !!process.env.NOW_REGION || process.env.SERVERLESS === '1';
if (!isServerless) {
  start();
}

export default app;
export { app, server };
