import type { Agent } from '@earendil-works/pi-agent-core';
import { AssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream';
import { InputError } from './material.js';
export type BudgetView = { limit: number; used: number; reported: number; warning: boolean; accounting: 'conservative-estimate' };
export class TokenBudget {
  used = 0;
  reported = 0;
  error: string | null = null;
  constructor(readonly limit: number) {}
  reserve(tokens: number) {
    if (this.used + tokens > this.limit) {
      this.error = `本課程用量預算不足（已預留 ${this.used}／${this.limit}，下一次需 ${tokens}）。已停止新增生成；可閱讀既有內容。這是保守估算，不是帳單上限。`;
      throw new InputError(this.error, 429);
    }
    this.used += tokens;
  }
  observe(tokens: number, reserved = Infinity) { if (Number.isFinite(tokens) && tokens > 0) { this.reported += tokens; this.used += Math.max(0, tokens - reserved); } }
  view(): BudgetView { return { limit: this.limit, used: this.used, reported: this.reported, warning: this.used >= this.limit * .8, accounting: 'conservative-estimate' }; }
  wrap(stream: Agent['streamFunction'], valid: () => boolean, changed: () => void): Agent['streamFunction'] {
    return async (model, context, options) => {
      if (!valid() || options?.signal?.aborted) throw new InputError('此回合已停止。');
      const output = Math.min(2048, model.maxTokens);
      // UTF-8 serialized request bytes + bounded output allowance per EVERY dispatch.
      // Keep reservations on failure/cancellation: unknown usage never becomes a free retry.
      const reserved = Buffer.byteLength(JSON.stringify(context), 'utf8') + output + 1024;
      this.reserve(reserved);
      changed();
      const source = await stream(model, context, { ...options, maxTokens: output });
      const result = new AssistantMessageEventStream();
      void (async () => {
        try {
          for await (const event of source) {
            if (event.type === 'done' || event.type === 'error') {
              const usage = event.type === 'done' ? event.message.usage : event.error.usage;
              if (valid()) { this.observe(usage.totalTokens, reserved); changed(); }
            }
            result.push(event);
          }
        } finally { result.end(); }
      })().catch(() => result.end());
      return result;
    };
  }
}
export function positiveSetting(value: string | undefined, fallback: number, max = 10000000) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new InputError('本機限制設定必須為範圍內的正整數。');
  return n;
}
