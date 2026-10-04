import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { Citation, Material } from '../shared/contracts.js';
export class InputError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const importSchema = z.object({ name: z.string().trim().min(1).max(120), text: z.string().max(40000), origin: z.enum(['upload', 'paste']), learningGoal: z.string().trim().max(500).default('') }).strict();
export function importMaterial(input: unknown): Material {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) throw new InputError('教材格式不正確，請提供 40–40,000 字的 UTF-8 純文字或 Markdown。');
  const { name, origin } = parsed.data;
  if (origin === 'upload' && !/\.(md|txt)$/i.test(name)) throw new InputError('目前支援 .txt 與 .md；PDF、圖片與網址擷取尚未支援。');
  const text = parsed.data.text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (text.length < 40 || Buffer.byteLength(text, 'utf8') > 65536 || Array.from(text).some(c => (c.charCodeAt(0) < 32 && c !== '\n' && c !== '\t') || c === '\ufffd')) throw new InputError('請提供 40 字以上、64 KB 以下的有效 UTF-8 文字教材。');
  const lines = text.split('\n');
  if (lines.length > 800) throw new InputError('教材最多 800 行，請先選取想學的一小節。');
  return { id: randomUUID(), name, text, lines, sha256: createHash('sha256').update(text).digest('hex'), importedAt: new Date().toISOString(), origin, learningGoal: parsed.data.learningGoal, sources: [] };
}
export async function sampleMaterial(learningGoal = ''): Promise<Material> {
  const text = await readFile(new URL('../samples/typescript-intro.md', import.meta.url), 'utf8');
  return { ...importMaterial({ name: 'TypeScript 入門 · 官方手冊導讀', text, origin: 'paste', learningGoal }), origin: 'sample', sources: [
    { title: 'TypeScript for the New Programmer', url: 'https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html' },
    { title: 'Everyday Types', url: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html' },
    { title: 'The Basics', url: 'https://www.typescriptlang.org/docs/handbook/2/basic-types.html' },
  ] };
}
export function verifyCitations(material: Material, citations: Citation[]) {
  for (const ref of citations) {
    if (ref.end < ref.start || ref.end > material.lines.length || ref.end - ref.start > 10 || !material.lines.slice(ref.start - 1, ref.end).join('\n').includes(ref.quote)) {
      throw new InputError('來源引用未通過核對：行號與引文必須與教材一致。');
    }
  }
}
