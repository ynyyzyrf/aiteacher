import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../server/app';
let server: Server, base: string, close: () => Promise<void>;
beforeAll(async () => {
  const result = await createApp('fixture'); close = result.close;
  server = result.app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { await close(); await new Promise<void>(r => server.close(() => r())); });
it('API makes fixture status unambiguous and does not claim live access', async () => {
  const health = await (await fetch(`${base}/api/health`)).json();
  expect(health.mode).toBe('fixture'); expect(health.modelAvailable).toBe(false); expect(health.harness).toContain('pi-coding-agent');
});
it('validates malformed requests, rejects cross-site writes and bounds upload size', async () => {
  const request = (body: string, headers = {}) => fetch(`${base}/api/materials`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  expect((await request('{broken')).status).toBe(400);
  expect((await request(JSON.stringify({ sample: true }), { Origin: 'https://untrusted.example' })).status).toBe(403);
  expect((await request(JSON.stringify({ text: 'a'.repeat(160000) }))).status).toBe(413);
  expect((await fetch(`${base}/api/lessons/missing`)).status).toBe(404);
});
it('imports actual content through HTTP and removes a session cleanly', async () => {
  const response = await fetch(`${base}/api/materials`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '測試.txt', origin: 'upload', text: '這是一份透過 HTTP 真正匯入的自訂教材，內容不是預先寫好的課程。學習者可以上傳自己的筆記。' }) });
  expect(response.status).toBe(201); const lesson = await response.json();
  expect(lesson.material.text).toContain('HTTP'); expect(lesson.plan).toBeNull(); expect(lesson.material.sha256).toHaveLength(64);
  expect((await fetch(`${base}/api/lessons/${lesson.id}`, { method: 'DELETE' })).status).toBe(204);
  expect((await fetch(`${base}/api/lessons/${lesson.id}`)).status).toBe(404);
});
