import { describe, expect, it } from 'vitest';
import { importMaterial, sampleMaterial, verifyCitations } from '../server/material';
import { beatSchema } from '../shared/contracts';
describe('material provenance and constrained board data', () => {
  it('imports genuine user text, normalizes CRLF and fingerprints content', () => {
    const text = '自訂教材與 TypeScript 無關：植物透過光合作用利用光能。\r\n葉綠素吸收光，植物利用水與二氧化碳形成有機物並釋放氧氣。';
    const a = importMaterial({ name: 'biology.md', text, origin: 'upload' });
    const b = importMaterial({ name: '另一個標題', text: text.replaceAll('\r', ''), origin: 'paste' });
    expect(a.lines).toHaveLength(2); expect(a.sha256).toBe(b.sha256); expect(a.sources).toEqual([]);
    expect(() => verifyCitations(a, [{ start: 2, end: 2, quote: '葉綠素吸收光' }])).not.toThrow();
    expect(() => verifyCitations(a, [{ start: 1, end: 1, quote: '葉綠素吸收光' }])).toThrow();
    expect(() => verifyCitations(a, [{ start: 1, end: 900, quote: '不存在' }])).toThrow();
  });
  it.each([
    { name: 'book.pdf', text: 'a'.repeat(60), origin: 'upload' },
    { name: 'empty.md', text: ' ', origin: 'upload' },
    { name: 'binary.txt', text: 'a'.repeat(60) + '\u0000', origin: 'upload' },
    { name: 'large.md', text: '中'.repeat(30000), origin: 'upload' },
    { name: 'lines.md', text: 'line\n'.repeat(801), origin: 'upload' },
  ])('rejects unsupported or invalid material: $name', input => expect(() => importMaterial(input)).toThrow());
  it('ships a source-backed sample, not a prebuilt lesson', async () => {
    const sample = await sampleMaterial();
    expect(sample.origin).toBe('sample'); expect(sample.sources).toHaveLength(3);
    expect(sample.text).toContain('不會自動驗證執行時的外部資料');
    expect(sample.text).toContain('noEmitOnError');
  });
  it('rejects unbounded arbitrary HTML, SVG, tool actions, and long narration', () => {
    const base = { step: 0, narration: '說明', visual: { kind: 'text', text: '<script>alert(1)</script>' }, citations: [{ start: 1, end: 1, quote: '來源' }] };
    expect(beatSchema.safeParse(base).success).toBe(true); // text is rendered as text nodes, never HTML.
    expect(beatSchema.safeParse({ ...base, visual: { kind: 'svg', text: '<svg/>' } }).success).toBe(false);
    expect(beatSchema.safeParse({ ...base, narration: 'x'.repeat(361) }).success).toBe(false);
    expect(beatSchema.safeParse({ ...base, shell: 'rm -rf /' }).success).toBe(false);
  });
});
it('shares identical progressive board projection with the model context', async () => {
  const { visibleVisual, visibleNarration } = await import('../shared/contracts');
  const beat = { id: 'id', step: 0, kind: 'lesson' as const, cursor: 2, narration: '一二三四', visual: { kind: 'code' as const, text: '12345678' }, citations: [] };
  expect(visibleNarration(beat)).toBe('一二'); expect(visibleVisual(beat)).toEqual({ kind: 'code', text: '1234' });
  expect(visibleVisual({ ...beat, visual: { kind: 'flow', nodes: ['一', '二', '三', '四'] } })).toEqual({ kind: 'flow', nodes: ['一', '二'] });
});
it('keeps learner goals separate from quoted source text and its fingerprint', async () => {
  const a = await sampleMaterial('先幫我補 JavaScript 的變數與函式，再解釋 TypeScript。');
  const b = await sampleMaterial();
  expect(a.learningGoal).toContain('變數與函式'); expect(a.sha256).toBe(b.sha256);
  expect(a.text).toBe(b.text);
  expect(() => importMaterial({ name: '筆記', origin: 'paste', text: '有效教材'.repeat(20), learningGoal: 'x'.repeat(501) })).toThrow();
});

it('accepts only bounded typography equivalents within the cited lines', () => {
  const m = importMaterial({ name: '來源', origin: 'paste', text: '這是來源說明：型別（string）是文字，不能變成數字。\n這行有不同的概念，引用時必須使用正確的行號。' });
  expect(() => verifyCitations(m, [{ start: 1, end: 1, quote: '型別(string) 是文字,不能變成數字。' }])).not.toThrow();
  expect(() => verifyCitations(m, [{ start: 2, end: 2, quote: '型別（string）是文字' }])).toThrow(/L2.*這行/);
  expect(() => verifyCitations(m, [{ start: 1, end: 1, quote: '型別（number）是文字' }])).toThrow(/L1/);
  expect(() => verifyCitations(m, [{ start: 0, end: 1, quote: '型別' }])).toThrow();
});
it('requires short narration and unambiguous ordered flow anchors', async () => {
  const b = { step: 0, narration: '先輸入，然後檢查，接著轉換，最後輸出。', visual: { kind: 'flow', nodes: ['輸入', '檢查', '轉換', '輸出'], anchors: ['輸入', '檢查', '轉換', '輸出'] }, citations: [{ start: 1, end: 1, quote: '來源' }] };
  expect(beatSchema.safeParse({ ...b, narration: '字'.repeat(200), visual: { kind: 'text', text: '文字' } }).success).toBe(true);
  expect(beatSchema.safeParse({ ...b, narration: '字'.repeat(201), visual: { kind: 'text', text: '文字' } }).success).toBe(false);
  expect(beatSchema.safeParse(b).success).toBe(true);
  const { visibleVisual } = await import('../shared/contracts');
  expect(visibleVisual({ ...beatSchema.parse(b), id: 'flow', kind: 'lesson', cursor: 8 })).toEqual({ kind: 'flow', nodes: ['輸入', '檢查'] });
  expect(beatSchema.safeParse({ ...b, narration: b.narration + '再次輸入' }).success).toBe(false);
  expect(beatSchema.safeParse({ ...b, visual: { ...b.visual, anchors: ['不存在'] } }).success).toBe(false);
});
it('reports actual material bytes and line counts', () => {
  expect(() => importMaterial({ name: 'big.txt', origin: 'upload', text: '中'.repeat(22000) })).toThrow(/66000.*65536/);
  expect(() => importMaterial({ name: 'lines.txt', origin: 'upload', text: Array(801).fill('文字').join('\n') })).toThrow(/801.*800/);
});
