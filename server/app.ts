import express from 'express';
import { actionSchema } from '../shared/contracts.js';
import { InputError, importMaterial, sampleMaterial } from './material.js';
import { LessonStore } from './store.js';
import { Lesson } from './lesson.js';
import { createRuntime } from './pi.js';
export async function createApp(mode: 'live' | 'fixture' = process.env.MAG_MODE === 'fixture' ? 'fixture' : 'live', store = new LessonStore()) {
  const app = express();
  const runtime = await createRuntime(mode);
  const lessons = new Map<string, Lesson>(store.load(runtime, mode).map(l => [l.state.id, l]));
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return res.status(403).json({ error: '不接受跨站請求。' });
    next();
  });
  app.use(express.json({ limit: '150kb' }));
  app.get('/api/health', async (_req, res) => {
    const models = mode === 'live' ? await runtime.getAvailable() : [];
    const selected = models.find(m => (!process.env.PI_PROVIDER || m.provider === process.env.PI_PROVIDER) && (!process.env.PI_MODEL || m.id === process.env.PI_MODEL));
    res.json({ mode, harness: '@earendil-works/pi-coding-agent@1.0.2', modelAvailable: !!selected, model: selected ? `${selected.provider}/${selected.id}` : null,
      voice: 'browser-speech-experimental', message: mode === 'fixture' ? '離線互動測試：Pi SDK 實際執行，但模型輸出為固定替身。' : selected ? 'Pi 模型已設定；尚不代表本次教學已驗證。' : '未設定可用的 Pi 模型。仍可匯入與核對教材。' });
  });
  app.post('/api/materials', async (req, res) => {
    for (const [id, lesson] of lessons) if (Date.now() - lesson.touchedAt > 60 * 60 * 1000) { await lesson.dispose(); lessons.delete(id); store.remove(id); }
    if (lessons.size >= 20) throw new InputError('本機工作階段已達上限，請重新啟動服務。', 429);
    if (req.body?.learningGoal !== undefined && (typeof req.body.learningGoal !== 'string' || req.body.learningGoal.trim().length > 500)) throw new InputError('學習目標最多 500 字。');
    const material = req.body?.sample === true ? await sampleMaterial(req.body.learningGoal ?? '') : importMaterial(req.body);
    const lesson = new Lesson(material, runtime, mode, 45000, { changed: l => store.save(l) }); store.save(lesson); lessons.set(lesson.state.id, lesson);
    res.status(201).json(lesson.snapshot());
  });
  app.get('/api/lessons/:id', (req, res) => {
    const lesson = lessons.get(req.params.id); if (!lesson) throw new InputError('找不到或已過期的學習進度；請重新匯入教材。', 404);
    res.json(lesson.snapshot());
  });
  app.post('/api/lessons/:id/actions', async (req, res) => {
    const lesson = lessons.get(req.params.id); if (!lesson) throw new InputError('找不到學習進度；請重新匯入教材。', 404);
    const parsed = actionSchema.safeParse(req.body); if (!parsed.success) throw new InputError('操作格式不正確。');
    res.json(await lesson.action(parsed.data));
  });
  app.delete('/api/lessons/:id', async (req, res) => {
    const lesson = lessons.get(req.params.id); await lesson?.dispose(); lessons.delete(req.params.id); store.remove(req.params.id); res.status(204).end();
  });
  app.use('/api', (_req, _res, next) => next(new InputError('找不到此操作。', 404)));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error instanceof InputError ? error.status : error instanceof SyntaxError ? 400 : (error as { type?: string })?.type === 'entity.too.large' ? 413 : 500;
    res.status(status).json({ error: error instanceof InputError ? error.message : status === 413 ? '教材太大，請選擇 64 KB 以下的純文字。' : '請求未完成，請確認內容後重試。' });
  });
  return { app, lessons, runtime, close: async () => { await Promise.all([...lessons.values()].map(l => l.dispose())); } };
}
