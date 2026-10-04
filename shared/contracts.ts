import { z } from 'zod';
export const citationSchema = z.object({ start: z.number().int().min(1), end: z.number().int().min(1), quote: z.string().min(2).max(500) }).strict();
export const planSchema = z.object({ title: z.string().min(1).max(80), steps: z.array(z.object({ title: z.string().min(1).max(60), goal: z.string().min(1).max(180), citations: z.array(citationSchema).min(1).max(3) }).strict()).min(2).max(8) }).strict();
export const visualSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string().min(1).max(600) }).strict(),
  z.object({ kind: z.literal('code'), text: z.string().min(1).max(600) }).strict(),
  z.object({ kind: z.literal('flow'), nodes: z.array(z.string().min(1).max(40)).min(2).max(4) }).strict(),
]);
export const beatSchema = z.object({ step: z.number().int().min(0).max(7), narration: z.string().min(1).max(360), visual: visualSchema, citations: z.array(citationSchema).min(1).max(3) }).strict();
export type Citation = z.infer<typeof citationSchema>;
export type Plan = z.infer<typeof planSchema>;
export type BeatInput = z.infer<typeof beatSchema>;
export type Beat = BeatInput & { id: string; kind: 'lesson' | 'clarification'; cursor: number };
export type Material = { id: string; name: string; text: string; lines: string[]; sha256: string; importedAt: string; origin: 'sample' | 'upload' | 'paste'; learningGoal: string; sources: { title: string; url: string }[] };
export type LessonView = {
  id: string; revision: number; mode: 'live' | 'fixture'; material: Material; plan: Plan | null;
  step: number; beats: Beat[]; activeBeatId: string | null; selectedBeatId: string | null;
  status: 'idle' | 'generating' | 'playing' | 'paused' | 'ready' | 'clarifying' | 'error' | 'complete';
  questions: { text: string; beatId: string | null }[]; error: string | null; model: string | null;
};
export const actionSchema = z.object({
  requestId: z.string().uuid(), revision: z.number().int().nonnegative(),
  action: z.enum(['start', 'next', 'pause', 'ask', 'resume', 'ack', 'retry']),
  question: z.string().trim().min(1).max(1000).optional(),
  beatId: z.string().max(60).nullable().optional(), cursor: z.number().int().nonnegative().optional(),
  contextBeatId: z.string().max(60).nullable().optional(),
}).strict();
export type Action = z.infer<typeof actionSchema>;
export const narrationLength = (beat: Beat) => Array.from(beat.narration).length;
export const visibleNarration = (beat: Beat, cursor = beat.cursor) => Array.from(beat.narration).slice(0, cursor).join('');

export function visibleVisual(beat: Beat, cursor = beat.cursor): BeatInput['visual'] {
  const ratio = Math.min(1, cursor / narrationLength(beat));
  return beat.visual.kind === 'flow' ? { kind: 'flow', nodes: beat.visual.nodes.slice(0, Math.ceil(beat.visual.nodes.length * ratio)) } :
    { kind: beat.visual.kind, text: Array.from(beat.visual.text).slice(0, Math.ceil(Array.from(beat.visual.text).length * ratio)).join('') };
}
