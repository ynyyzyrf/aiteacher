import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { beatSchema, planSchema, narrationLength } from '../shared/contracts.js';
import { Lesson, type LessonOptions } from './lesson.js';
import { importMaterial, verifyCitations } from './material.js';
const id = z.string().uuid();
const archiveSchema = z.object({
  version: z.literal(1), touchedAt: z.number(), savedBeatId: id.nullable(), lastIntent: z.enum(['teach', 'clarify']), lastQuestion: z.string().max(1000), lastCommittedId: id.nullable(), requests: z.array(id).max(200),
  state: z.object({
    id, revision: z.number().int().nonnegative(), mode: z.enum(['live','fixture']), material: z.object({ id, name: z.string(), text: z.string().max(40000), lines: z.array(z.string()), sha256: z.string(), importedAt: z.string(), origin: z.enum(['sample','upload','paste']), learningGoal: z.string().max(500), sources: z.array(z.object({ title: z.string(), url: z.string().url() })).max(10) }),
    plan: planSchema.nullable(), step: z.number().int().min(0).max(7), beats: z.array(beatSchema.safeExtend({ id, kind: z.enum(['lesson','clarification']), cursor: z.number().int().nonnegative() })).max(1000),
    activeBeatId: id.nullable(), selectedBeatId: id.nullable(), status: z.enum(['idle','generating','playing','paused','ready','clarifying','error','complete']), questions: z.array(z.object({ text: z.string().max(1000), beatId: id.nullable() })).max(1000), error: z.string().nullable(), model: z.string().nullable(),
    budget: z.object({ limit: z.number().int().positive(), used: z.number().int().nonnegative(), reported: z.number().nonnegative(), warning: z.boolean(), accounting: z.literal('conservative-estimate') }),
  }),
});
export type LessonArchive = ReturnType<Lesson['archive']>;
export class LessonStore {
  constructor(readonly directory = resolve(process.env.MAG_DATA_DIR ?? '.mag-lessons')) { mkdirSync(directory, { recursive: true, mode: 0o700 }); }
  save(lesson: Lesson) {
    const path = resolve(this.directory, `${lesson.state.id}.json`);
    writeFileSync(`${path}.tmp`, JSON.stringify(lesson.archive()), { mode: 0o600 });
    renameSync(`${path}.tmp`, path);
  }
  remove(lessonId: string) { if (id.safeParse(lessonId).success) rmSync(resolve(this.directory, `${lessonId}.json`), { force: true }); }
  load(runtime: ModelRuntime, mode: 'live'|'fixture', options: LessonOptions = {}) {
    const lessons: Lesson[] = [];
    for (const file of readdirSync(this.directory)) {
      if (!/^[a-f0-9-]{36}\.json$/.test(file)) continue;
      const path = resolve(this.directory, file);
      try {
        if (statSync(path).size > 2000000) continue;
        const raw = JSON.parse(readFileSync(path, 'utf8'));
        const parsed = archiveSchema.safeParse(raw);
        if (!parsed.success) continue;
        const archive = parsed.data;
        if (Date.now() - archive.touchedAt > 3600000) { rmSync(path); continue; }
        if (archive.state.mode !== mode || lessons.length >= 20 || file !== `${archive.state.id}.json`) continue;
        const m = archive.state.material;
        const checked = importMaterial({ name: m.name, origin: m.origin === 'sample' ? 'paste' : m.origin, text: m.text, learningGoal: m.learningGoal });
        if (m.sha256 !== checked.sha256 || JSON.stringify(m.lines) !== JSON.stringify(checked.lines)) continue;
        archive.state.plan?.steps.forEach(s => verifyCitations(m, s.citations));
        archive.state.beats.forEach(b => { verifyCitations(m, b.citations); if (b.cursor > narrationLength(b) || b.step >= (archive.state.plan?.steps.length ?? 0)) throw new Error('invalid checkpoint'); });
        const ids = new Set(archive.state.beats.map(b => b.id));
        if (ids.size !== archive.state.beats.length || [archive.savedBeatId, archive.lastCommittedId, archive.state.activeBeatId, archive.state.selectedBeatId].some(x => x && !ids.has(x))) continue;
        const lesson = Lesson.restore(archive, runtime, { ...options, changed: l => this.save(l) });
        lessons.push(lesson);
      } catch { /* Corrupt archives never become executable context; do not expose source data. */ }
    }
    return lessons;
  }
}
