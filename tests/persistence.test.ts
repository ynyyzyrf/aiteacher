import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LessonStore } from '../server/store';
import { Lesson } from '../server/lesson';
import { createRuntime } from '../server/pi';
import { sampleMaterial } from '../server/material';
it('restores server-validated cursor and source-backed context after process restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mag-store-'));
  const runtime = await createRuntime('fixture');
  const store = new LessonStore(dir);
  const l = new Lesson(await sampleMaterial(), runtime, 'fixture', 45000, { changed: lesson => store.save(lesson) });
  const action = (lesson: Lesson, name: 'start'|'pause'|'ask'|'resume', extra = {}) => lesson.action({ requestId: randomUUID(), revision: lesson.state.revision, action: name, ...extra });
  try {
    await action(l, 'start'); await l.settled(); const id = l.state.activeBeatId;
    await action(l, 'pause', { beatId: id, cursor: 12 }); await l.dispose();
    const restored = store.load(runtime, 'fixture')[0];
    expect(restored.state.id).toBe(l.state.id); expect(restored.state.beats[0].cursor).toBe(12);
    expect(restored.state.budget.used).toBeGreaterThan(0);
    await action(restored, 'ask', { question: '剛才這裡不懂', beatId: id, cursor: 12 }); await restored.settled();
    expect(restored.state.error).toBeNull(); expect(restored.state.beats[1].narration).toContain(Array.from(l.state.beats[0].narration).slice(0,12).join(''));
    await action(restored, 'pause'); await action(restored, 'resume'); expect(restored.state.activeBeatId).toBe(id);
    await restored.dispose();
    const file = join(dir, `${l.state.id}.json`); const invalid = JSON.parse(readFileSync(file,'utf8')); invalid.state.beats[0].citations[0].start = 799; writeFileSync(file, JSON.stringify(invalid));
    expect(store.load(runtime, 'fixture')).toHaveLength(0);
    store.remove(l.state.id); expect(() => readFileSync(file)).toThrow();
  } finally { await l.dispose(); rmSync(dir, { recursive: true, force: true }); }
});
