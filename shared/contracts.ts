import { z } from 'zod';
export const citationSchema = z.object({ start: z.number().int().min(1), end: z.number().int().min(1), quote: z.string().min(2).max(500) }).strict();
export const planSchema = z.object({ title: z.string().min(1).max(80), steps: z.array(z.object({ title: z.string().min(1).max(60), goal: z.string().min(1).max(180), citations: z.array(citationSchema).min(1).max(3) }).strict()).min(2).max(8) }).strict();
export const visualSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string().min(1).max(600) }).strict(),
  z.object({ kind: z.literal('code'), text: z.string().min(1).max(600) }).strict(),
  z.object({ kind: z.literal('flow'), nodes: z.array(z.string().min(1).max(40)).min(2).max(4), anchors: z.array(z.string().min(1).max(80)).min(2).max(4).optional() }).strict(),
]);
export const beatSchema = z.object({ step: z.number().int().min(0).max(7), narration: z.string().min(1).max(200, '講解最多 200 字，請拆成較短的白板片段，不要截斷內容。'), visual: visualSchema, citations: z.array(citationSchema).min(1).max(3) }).strict().superRefine((beat, ctx) => {
  if (beat.visual.kind !== 'flow' || !beat.visual.anchors) return;
  let previous = -1;
  if (beat.visual.anchors.length !== beat.visual.nodes.length) ctx.addIssue({ code: 'custom', message: '每個節點需要一個講解錨點。' });
  for (const anchor of beat.visual.anchors) {
    const index = beat.narration.indexOf(anchor);
    if (index < 0 || index <= previous || beat.narration.indexOf(anchor, index + 1) >= 0) ctx.addIssue({ code: 'custom', message: '錨點須在講解中唯一出現，並依節點順序排列。' });
    previous = index;
  }
});
export type Citation = z.infer<typeof citationSchema>;
export type Plan = z.infer<typeof planSchema>;
export type BeatInput = z.infer<typeof beatSchema>;
export type Beat = BeatInput & { id: string; kind: 'lesson' | 'clarification'; cursor: number };
export type Material = { id: string; name: string; text: string; lines: string[]; sha256: string; importedAt: string; origin: 'sample' | 'upload' | 'paste'; learningGoal: string; sources: { title: string; url: string }[] };
export type LessonView = {
  budget: { limit: number; used: number; reported: number; warning: boolean; accounting: 'conservative-estimate' };
  id: string; revision: number; mode: 'live' | 'fixture'; material: Material; plan: Plan | null;
  step: number; beats: Beat[]; activeBeatId: string | null; selectedBeatId: string | null;
  status: 'idle' | 'generating' | 'playing' | 'paused' | 'ready' | 'clarifying' | 'error' | 'complete';
  questions: { text: string; beatId: string | null }[]; error: string | null; model: string | null;
};
export const actionSchema = z.object({
  requestId: z.string().uuid(), revision: z.number().int().nonnegative(),
  action: z.enum(['start', 'next', 'pause', 'ask', 'resume', 'ack', 'retry', 'checkpoint']),
  question: z.string().trim().min(1).max(1000).optional(),
  beatId: z.string().max(60).nullable().optional(), cursor: z.number().int().nonnegative().optional(),
  contextBeatId: z.string().max(60).nullable().optional(),
}).strict();
export type Action = z.infer<typeof actionSchema>;
export const narrationLength = (beat: Beat) => Array.from(beat.narration).length;
export const visibleNarration = (beat: Beat, cursor = beat.cursor) => Array.from(beat.narration).slice(0, cursor).join('');

export function visibleVisual(beat: Beat, cursor = beat.cursor): BeatInput['visual'] {
  const ratio = Math.min(1, cursor / narrationLength(beat));
  const visual = beat.visual;
  if (visual.kind === 'flow') {
    const anchors = visual.anchors;
    const nodes = anchors ? visual.nodes.filter((_node, i) => {
      const end = beat.narration.indexOf(anchors[i]) + anchors[i].length;
      return cursor >= Array.from(beat.narration.slice(0, end)).length;
    }) : visual.nodes.slice(0, Math.ceil(visual.nodes.length * ratio));
    return { kind: 'flow', nodes };
  }
  return { kind: visual.kind, text: Array.from(visual.text).slice(0, Math.ceil(Array.from(visual.text).length * ratio)).join('') };
}
