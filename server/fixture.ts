// Explicit offline MODEL fixture. Pi still owns the agent loop and executes the real tools.
// Never used as a fallback for a failed live model. No educational-quality claims.
import type { Agent } from '@earendil-works/pi-agent-core';
import type { AssistantMessage, ToolCall } from '@earendil-works/pi-ai';
import { AssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream';
import type { Material } from '../shared/contracts.js';
export function fixtureStream(material: Material): Agent['streamFunction'] {
  const excerpts = material.lines.map((text, i) => ({ text, line: i + 1 })).filter(l => l.text.length >= 2 && !l.text.startsWith('#') && !l.text.includes('https://')).slice(0, 3);
  const refs = excerpts.map(e => ({ start: e.line, end: e.line, quote: e.text.slice(0, 180) }));
  if (!refs.length) refs.push({ start: 1, end: Math.min(10, material.lines.length), quote: material.lines.slice(0, 10).join('\n').slice(0, 180) });
  if (refs.length < 2) refs.push(refs[0]);
  return (model, context, options) => {
    const stream = new AssistantMessageEventStream();
    const lastUser = context.messages.findLast(m => m.role === 'user');
    const text = lastUser && Array.isArray(lastUser.content) ? lastUser.content.filter(c => c.type === 'text').map(c => c.text).join('') : '';
    const command = JSON.parse(text || '{}') as { step?: number; intent?: string; context?: { narration?: string } };
    const step = command.step ?? 0;
    const index = Math.min(step, refs.length - 1);
    const hasPlan = context.messages.some(m => m.role === 'toolResult' && m.toolName === 'plan_lesson' && !m.isError);
    const afterUser = context.messages.slice(context.messages.lastIndexOf(lastUser!)+1);
    const beatDone = afterUser.some(m => m.role === 'toolResult' && m.toolName === 'board_beat' && !m.isError);
    const call: ToolCall | undefined = !hasPlan ? { type: 'toolCall', id: crypto.randomUUID(), name: 'plan_lesson', arguments: {
      title: '離線互動測試 · 教材原文重播', steps: refs.map((r, i) => ({ title: `閱讀片段 ${i + 1}`, goal: '檢查來源、白板與中斷流程（不是 AI 教學）', citations: [r] })),
    } } : !beatDone ? { type: 'toolCall', id: crypto.randomUUID(), name: 'board_beat', arguments: {
      step, narration: command.intent === 'clarify' ? `【離線回應，沒有模型理解問題】你剛看到「${(command.context?.narration ?? '').slice(0, 70)}」。此處僅重播來源供測試；真正釐清需啟用 Pi 模型。` : `【離線原文重播】${refs[index].quote} 讀完可以問「這裡不懂」，檢查是否停在同一個位置。`,
      visual: { kind: 'text', text: refs[index].quote }, citations: [refs[index]],
    } } : undefined;
    const timer = setTimeout(() => {
      const aborted = options?.signal?.aborted;
      const message: AssistantMessage = { role: 'assistant', content: aborted ? [] : call ? [call] : [{ type: 'text', text: '' }], api: model.api, provider: model.provider, model: model.id,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: aborted ? 'aborted' : call ? 'toolUse' : 'stop', timestamp: Date.now() };
      if (aborted) stream.push({ type: 'error', reason: 'aborted', error: message });
      else stream.push({ type: 'done', reason: call ? 'toolUse' : 'stop', message });
      stream.end();
    }, 90);
    timer.unref?.();
    return stream;
  };
}
