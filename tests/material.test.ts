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
