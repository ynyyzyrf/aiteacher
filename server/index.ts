import express from 'express';
import { resolve } from 'node:path';
import { createApp } from './app.js';
const { app, close } = await createApp();
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true, hmr: { port: Number(process.env.PORT ?? 5173) + 1000 } }, appType: 'spa' });
  app.use(vite.middlewares);
}
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 5173);
const server = app.listen(port, host, () => console.log(`MAG learning room: http://${host}:${port} · ${process.env.MAG_MODE === 'fixture' ? 'OFFLINE MODEL FIXTURE / real Pi harness' : 'LIVE PI (no mock fallback)'}`));
const shutdown = async () => { await close(); server.close(); process.exit(0); };
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
