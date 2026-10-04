import { expect, it } from 'vitest';
import { normalizeContext } from '@earendil-works/pi-ai/utils/transcript';
import { TokenBudget } from '../server/budget';
it('reserves every call including failed attempts and rejects before dispatch', () => {
  const budget = new TokenBudget(100);
  budget.reserve(81);
  expect(budget.view().warning).toBe(true);
  expect(() => budget.reserve(20)).toThrow('預算');
  expect(budget.view().used).toBe(81);
  budget.reserve(19);
  expect(() => budget.reserve(1)).toThrow('預算');
});
it('records provider usage separately without refunding failed or estimated reservations', () => {
  const budget = new TokenBudget(100);
  budget.reserve(50); budget.observe(12);
  expect(budget.view()).toMatchObject({ used: 50, reported: 12, accounting: 'conservative-estimate' });
});
it('charges failed dispatches and blocks the next call before reaching the provider', async () => {
  const { createRuntime } = await import('../server/pi');
  const runtime = await createRuntime('fixture');
  const model = runtime.getModel('anthropic', 'claude-sonnet-4-5')!;
  const budget = new TokenBudget(4000);
  let calls = 0;
  const wrapped = budget.wrap(() => { calls++; throw new Error('provider failed'); }, () => true, () => {});
  await expect(wrapped(model, normalizeContext({ messages: [] }))).rejects.toThrow('provider failed');
  expect(budget.used).toBeGreaterThan(3000);
  await expect(wrapped(model, normalizeContext({ messages: [] }))).rejects.toThrow('預算');
  expect(calls).toBe(1);
});
it('counts unexpectedly larger reported usage against future allowance', () => {
  const b = new TokenBudget(100); b.reserve(40); b.observe(90, 40);
  expect(b.view()).toMatchObject({ used: 90, reported: 90 });
  expect(() => b.reserve(11)).toThrow('預算');
});
