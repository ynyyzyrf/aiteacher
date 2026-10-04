import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { randomUUID } from 'node:crypto';
import { Lesson } from '../server/lesson';
import { createRuntime } from '../server/pi';
import { importMaterial, sampleMaterial } from '../server/material';
import { narrationLength, type Action } from '../shared/contracts';
let runtime: ModelRuntime;
const created: Lesson[] = [];
beforeAll(async () => { runtime = await createRuntime('fixture'); });
afterAll(async () => { await Promise.all(created.map(l => l.dispose())); });
async function lesson() { const l = new Lesson(await sampleMaterial(), runtime, 'fixture'); created.push(l); return l; }
function action(l: Lesson, kind: Action['action'], extra: Partial<Action> = {}) { return l.action({ requestId: randomUUID(), revision: l.state.revision, action: kind, ...extra }); }
async function start(l: Lesson) { await action(l, 'start'); await l.settled(); expect(l.state.error).toBeNull(); }
function ack(l: Lesson) { const beat = l.state.beats.find(b => b.id === l.state.activeBeatId)!; return action(l, 'ack', { beatId: beat.id, cursor: narrationLength(beat) }); }
describe('REAL Pi SDK loop, deterministic MOCK MODEL', () => {
  it('plans imported material and only exposes constrained teaching tools', async () => {
    const l = await lesson(); await start(l);
    expect(l.activeTools().sort()).toEqual(['board_beat', 'plan_lesson']);
    expect(l.state.plan?.steps.length).toBeGreaterThan(1); expect(l.state.beats).toHaveLength(1);
    const b = l.state.beats[0]; expect(l.state.material.text).toContain(b.citations[0].quote);
    expect(b.visual).toEqual({ kind: 'text', text: b.citations[0].quote });
  });
  it('interrupts exactly at displayed cursor, clarifies without advancing, resumes same beat', async () => {
    const l = await lesson(); await start(l); const id = l.state.activeBeatId!;
    await action(l, 'ask', { question: '這裡不懂', beatId: id, cursor: 12, contextBeatId: id });
    await l.settled();
    expect(l.state.step).toBe(0); expect(l.state.beats[0].cursor).toBe(12);
    expect(l.state.beats[1].kind).toBe('clarification'); expect(l.state.beats[1].narration).toContain('你剛看到');
    await ack(l); await action(l, 'resume');
    expect(l.state.activeBeatId).toBe(id); expect(l.state.beats[0].cursor).toBe(12);
    expect(l.state.status).toBe('playing'); await ack(l); await action(l, 'next'); await l.settled();
    expect(l.state.step).toBe(1); expect(l.state.beats).toHaveLength(3);
  });
  it('deduplicates repeated request IDs and rejects concurrent/stale next actions', async () => {
    const l = await lesson(); await start(l); await ack(l);
    const request: Action = { requestId: randomUUID(), revision: l.state.revision, action: 'next' };
    await Promise.all([l.action(request), l.action(request)]); await l.settled();
    expect(l.state.step).toBe(1); expect(l.state.beats).toHaveLength(2);
    await expect(l.action({ ...request, requestId: randomUUID() })).rejects.toThrow('畫面已更新');
    await expect(action(l, 'ack', { beatId: l.state.beats[0].id, cursor: 999 })).rejects.toThrow();
  });
  it('cancels generation before tool commit; resume does not skip a pending next step', async () => {
    const l = await lesson(); await start(l); await ack(l); await action(l, 'next');
    await action(l, 'pause'); const count = l.state.beats.length;
    await new Promise(r => setTimeout(r, 250)); expect(l.state.beats).toHaveLength(count);
    await action(l, 'resume'); await l.settled();
    expect(l.state.step).toBe(1); expect(l.state.beats.at(-1)?.step).toBe(1);
  });
  it('handles repeated questions and preserves the original resume checkpoint', async () => {
    const l = await lesson(); await start(l); const original = l.state.activeBeatId;
    await action(l, 'ask', { question: '這裡不懂', beatId: original, cursor: 7 }); await l.settled();
    const clarification = l.state.activeBeatId;
    await action(l, 'ask', { question: '再說一次', beatId: clarification, cursor: 10 }); await l.settled(); await ack(l);
    await action(l, 'resume'); expect(l.state.activeBeatId).toBe(original); expect(l.state.beats[0].cursor).toBe(7);
  });
  it('stops stale tools after abort and verifies source ranges at the mutation boundary', async () => {
    const l = await lesson(); await start(l); await action(l, 'pause');
    expect(() => l.acceptBeat({ step: 0, narration: '晚到的資料', visual: { kind: 'text', text: 'bad' }, citations: [{ start: 999, end: 999, quote: 'bad' }] })).toThrow('已中斷');
  });
  it('finishes without advancing beyond the plan', async () => {
    const l = await lesson(); await start(l);
    for (let i = 0; i < l.state.plan!.steps.length; i++) { await ack(l); await action(l, 'next'); await l.settled(); }
    expect(l.state.status).toBe('complete'); expect(l.state.step).toBe(l.state.plan!.steps.length - 1);
  });
  it('uses an arbitrary user upload rather than a hardcoded TypeScript course', async () => {
    const material = importMaterial({ name: 'biology.txt', origin: 'upload', text: '植物利用光能進行光合作用，水與二氧化碳參與反應，形成有機物。\n葉綠素吸收光，這是我們今天想了解的教材內容，並非程式語言課程。' });
    const l = new Lesson(material, runtime, 'fixture'); created.push(l); await start(l);
    expect(l.state.beats[0].citations[0].quote).toContain('光合作用');
    expect(JSON.stringify(l.state.beats)).not.toContain('TypeScript');
  });
});
it('bounded generation timeout yields a retryable failure, never mock fallback', async () => {
  const l = new Lesson(await sampleMaterial(), runtime, 'fixture', 1); created.push(l);
  await action(l, 'start'); await l.settled();
  expect(l.state.status).toBe('error'); expect(l.state.error).toContain('逾時'); expect(l.state.beats).toHaveLength(0);
});
it('offline fixture preserves citation ranges for valid short-line materials', async () => {
  const material = importMaterial({ name: '短行筆記', origin: 'paste', text: Array(30).fill('甲').join('\n') });
  const l = new Lesson(material, runtime, 'fixture'); created.push(l); await start(l);
  expect(l.state.beats[0].citations[0].end).toBe(10);
});
it('preserves known cursor when pause omits or names an old beat', async () => {
  const l = await lesson(); await start(l); const id = l.state.activeBeatId;
  await action(l, 'pause', { beatId: id, cursor: 8 }); await action(l, 'resume');
  await action(l, 'pause', { cursor: 99 }); expect(l.state.beats[0].cursor).toBe(8);
  await action(l, 'resume'); await action(l, 'pause', { beatId: 'stale-id', cursor: 100 });
  await action(l, 'resume'); expect(l.state.beats[0].cursor).toBe(8); expect(l.state.activeBeatId).toBe(id);
});
it('enforces configurable beat limit without duplicating committed content', async () => {
  const l = new Lesson(await sampleMaterial(), runtime, 'fixture', 45000, { maxBeats: 1 }); created.push(l);
  await start(l); await action(l, 'ask', { question: '再說一次', beatId: l.state.activeBeatId, cursor: 5 }); await l.settled();
  expect(l.state.status).toBe('error'); expect(l.state.error).toContain('1 個片段'); expect(l.state.beats).toHaveLength(1);
});
it('rejects a small token budget before model dispatch and bounds retries', async () => {
  const l = new Lesson(await sampleMaterial(), runtime, 'fixture', 45000, { tokenBudget: 10 }); created.push(l);
  await action(l, 'start'); await l.settled();
  expect(l.state.error).toContain('預算'); expect(l.state.beats).toHaveLength(0);
  await action(l, 'retry'); await l.settled(); expect(l.state.beats).toHaveLength(0);
});
