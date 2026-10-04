import { randomUUID } from 'node:crypto';
import type { AgentSession, ModelRuntime } from '@earendil-works/pi-coding-agent';
import { narrationLength, visibleNarration, visibleVisual, type Action, type Beat, type BeatInput, type LessonView, type Material, type Plan } from '../shared/contracts.js';
import { InputError, verifyCitations } from './material.js';
import type { LessonArchive } from './store.js';
import { TokenBudget, positiveSetting } from './budget.js';
import { createTeacher, teachingTools } from './pi.js';

export type LessonOptions = { maxBeats?: number; tokenBudget?: number; stopWaitMs?: number; changed?: (lesson: Lesson) => void };
type Run = { epoch: number; intent: 'teach' | 'clarify'; emitted: boolean; calls: number };
export class Lesson {
  readonly state: LessonView;
  private session?: AgentSession;
  private sessionGeneration = 0;
  private abandoned = 0;
  private budget: TokenBudget;
  private maxBeats: number;
  private validationError: string | null = null;
  private lastPersistAt = Date.now();
  private run?: Run;
  private epoch = 0;
  private task?: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private requests = new Set<string>();
  private savedBeatId: string | null = null;
  private lastIntent: 'teach' | 'clarify' = 'teach';
  private lastQuestion = '';
  private lastCommittedId: string | null = null;
  touchedAt = Date.now();
  constructor(material: Material, private runtime: ModelRuntime, mode: 'live' | 'fixture', private timeoutMs = 45000, private options: LessonOptions = {}) {
    this.budget = new TokenBudget(options.tokenBudget ?? positiveSetting(process.env.MAG_TOKEN_BUDGET, 200000));
    this.maxBeats = options.maxBeats ?? positiveSetting(process.env.MAG_MAX_BEATS, 80, 1000);
    this.state = { budget: this.budget.view(), id: randomUUID(), revision: 0, mode, material, plan: null, step: 0, beats: [], activeBeatId: null, selectedBeatId: null, status: 'idle', questions: [], error: null, model: null };
  }
  archive() {
    return { version: 1 as const, touchedAt: this.touchedAt, state: structuredClone(this.state), savedBeatId: this.savedBeatId, lastIntent: this.lastIntent, lastQuestion: this.lastQuestion, lastCommittedId: this.lastCommittedId, requests: [...this.requests] };
  }
  static restore(archive: LessonArchive, runtime: ModelRuntime, options: LessonOptions) {
    const lesson = new Lesson(archive.state.material, runtime, archive.state.mode, 45000, options);
    Object.assign(lesson.state, archive.state);
    lesson.budget = new TokenBudget(Math.min(lesson.budget.limit, archive.state.budget.limit));
    lesson.budget.used = archive.state.budget.used; lesson.budget.reported = archive.state.budget.reported;
    lesson.state.budget = lesson.budget.view();
    lesson.savedBeatId = archive.savedBeatId; lesson.lastIntent = archive.lastIntent;
    lesson.lastQuestion = archive.lastQuestion; lesson.lastCommittedId = archive.lastCommittedId;
    lesson.requests = new Set(archive.requests); lesson.touchedAt = archive.touchedAt;
    if (['playing', 'generating', 'clarifying'].includes(lesson.state.status)) lesson.state.status = 'paused';
    lesson.state.revision++;
    return lesson;
  }
  snapshot(): LessonView { this.touchedAt = Date.now(); if (this.touchedAt - this.lastPersistAt > 30000) { this.options.changed?.(this); this.lastPersistAt = this.touchedAt; } return structuredClone(this.state); }
  private changed() { this.state.budget = this.budget.view(); this.state.revision++; this.touchedAt = Date.now(); this.options.changed?.(this); }
  private guard(signal?: AbortSignal): Run {
    if (!this.run || signal?.aborted || this.run.epoch !== this.epoch) { void this.session?.abort(); throw new Error('此回合已中斷，不得更新白板。'); }
    if (++this.run.calls > 8) { void this.session?.abort(); throw new Error('工具呼叫次數超過限制。'); }
    return this.run;
  }
  acceptPlan(plan: Plan, signal?: AbortSignal) {
    const run = this.guard(signal);
    if (this.state.plan || run.intent !== 'teach') throw new Error('已有課程計畫，不得覆蓋。');
    plan.steps.forEach(s => verifyCitations(this.state.material, s.citations));
    this.state.plan = plan; this.changed();
  }
  acceptBeat(input: BeatInput, signal?: AbortSignal) {
    const run = this.guard(signal);
    if (!this.state.plan || input.step !== this.state.step || run.emitted) throw new Error('本回合只能提交指定步驟的一個白板片段。');
    verifyCitations(this.state.material, input.citations);
    if (this.state.beats.length >= this.maxBeats) throw new InputError(`本次學習已達 ${this.maxBeats} 個片段，請重新匯入教材。`);
    run.emitted = true;
    const beat: Beat = { ...input, id: randomUUID(), kind: run.intent === 'clarify' ? 'clarification' : 'lesson', cursor: 0 };
    this.lastCommittedId = beat.id;
    this.state.beats.push(beat); this.state.activeBeatId = beat.id; this.state.status = 'playing'; this.changed();
  }
  private async teacher() {
    if (!this.session) {
      const generation = this.sessionGeneration;
      const valid = () => generation === this.sessionGeneration;
      const session = await createTeacher(this.runtime, teachingTools({ invalid: message => { if (valid()) this.validationError = message; }, plan: (p, s) => { if (!valid()) throw new InputError('此工作階段已停止。'); this.acceptPlan(p, s); }, beat: (b, s) => { if (!valid()) throw new InputError('此工作階段已停止。'); this.acceptBeat(b, s); } }), this.state.mode, this.state.material);
      if (!valid()) { session.dispose(); throw new InputError('此工作階段已停止。'); }
      session.agent.streamFunction = this.budget.wrap(session.agent.streamFunction, valid, () => { if (valid()) this.changed(); });
      this.session = session;
      this.state.model = this.state.mode === 'fixture' ? '離線模型替身 · Pi SDK' : `${this.session.model?.provider}/${this.session.model?.id}`;
    }
    return this.session;
  }
  private generate(intent: 'teach' | 'clarify', question = '') {
    if (this.abandoned >= 2) { this.state.status = 'error'; this.state.error = '仍有模型工作無法結束，已停止新增工作。請稍後重試或重啟本機服務。'; this.changed(); return; }
    if (this.state.beats.length >= this.maxBeats) { this.state.status = 'error'; this.state.error = `本次學習已達 ${this.maxBeats} 個片段，請重新匯入教材。`; this.changed(); return; }
    const epoch = ++this.epoch;
    this.run = { epoch, intent, emitted: false, calls: 0 };
    this.validationError = null; this.lastIntent = intent; this.lastQuestion = question; this.lastCommittedId = null;
    this.state.error = null; this.state.status = intent === 'clarify' ? 'clarifying' : 'generating'; this.changed();
    const selected = this.state.beats.find(b => b.id === this.state.selectedBeatId) ?? this.state.beats.find(b => b.id === this.savedBeatId);
    const context = selected ? { id: selected.id, step: selected.step, narration: visibleNarration(selected), visual: visibleVisual(selected), fullVisual: selected.visual, cursor: selected.cursor, fullNarration: selected.narration } : null;
    const command = { committedHistory: this.state.beats.map(b => ({ step: b.step, kind: b.kind, narration: visibleNarration(b), visual: visibleVisual(b), citations: b.citations })), previousQuestions: this.state.questions, learningGoal: this.state.material.learningGoal, intent, step: this.state.step, question, context, plan: this.state.plan,
      instruction: intent === 'clarify' ? '停止原來的講解，只釐清 context 已呈現的內容。保持目前 step，不能推進。' : '如尚無 plan，先建立 plan；接著只教目前 step，一個 board_beat 後停止。前一步可能有釐清，請自然銜接。',
      material: { name: this.state.material.name, sha256: this.state.material.sha256, lines: this.state.material.lines.map((text, i) => ({ line: i + 1, text })) },
    };
    this.task = (async () => {
      let timedOut = false;
      const timer = setTimeout(() => { if (epoch !== this.epoch) return; timedOut = true; void this.stop(); this.state.status = 'error'; this.state.error = '模型回應逾時，已停止。可重試。'; this.changed(); }, this.timeoutMs);
      try {
        const session = await this.teacher();
        if (epoch !== this.epoch) return;
        // abort() can race Pi's async prompt preflight. Cancel again at agent_start
        // so a prompt cannot begin after the host has invalidated its generation.
        const unsubscribe = session.subscribe(event => {
          if (event.type === 'agent_start' && (epoch !== this.epoch || timedOut)) void session.abort();
        });
        try {
          if (timedOut) throw new InputError('模型回應逾時，請重試。', 504);
          await session.prompt(JSON.stringify(command), { expandPromptTemplates: false });
        } finally { unsubscribe(); }
        if (epoch !== this.epoch) return;
        if (this.budget.error) throw new InputError(this.budget.error, 429);
        if (timedOut) throw new InputError('模型回應逾時，已停止。可重試；已呈現內容會保留。', 504);
        const last = session.messages.findLast(m => m.role === 'assistant');
        if (last?.role === 'assistant' && (last.stopReason === 'error' || last.stopReason === 'aborted')) throw new InputError('Pi 模型未完成回應。請確認模型連線或配額後重試。', 502);
        if (!this.run?.emitted) throw new InputError(this.validationError ?? 'Pi 未產生通過來源與白板驗證的片段。請重試或換較短的教材。', 502);
      } catch (error) {
        if (epoch === this.epoch) {
          this.state.status = 'error';
          // Never expose raw provider errors: they may include credentials, endpoints or source payloads.
          this.state.error = this.budget.error ?? (error instanceof InputError ? error.message : '教學回應失敗，已停止。請重試或重新匯入教材。');
          this.changed();
        }
      } finally { clearTimeout(timer); if (epoch === this.epoch) this.run = undefined; }
    })();
  }
  private checkpoint(action: Action) {
    if (!action.beatId) return;
    const beat = this.state.beats.find(b => b.id === action.beatId);
    if (!beat || beat.id !== this.state.activeBeatId) return; // An earlier UI response cannot change a new beat.
    if (action.cursor !== undefined) beat.cursor = Math.max(beat.cursor, Math.min(action.cursor, narrationLength(beat)));
  }
  private async stop() {
    ++this.epoch; this.run = undefined;
    const session = this.session;
    const task = this.task;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = Promise.allSettled([session?.abort(), task]).then(() => true);
    const completed = await Promise.race([done, new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), this.options.stopWaitMs ?? 5000); })]);
    clearTimeout(timer);
    if (!completed && this.session === session && this.task === task) {
      this.abandoned++;
      ++this.sessionGeneration; this.session = undefined; this.task = undefined;
      session?.dispose();
      void done.then(() => { session?.dispose(); this.abandoned--; });
    }
  }
  action(action: Action): Promise<LessonView> {
    const execute = this.queue.then(() => this.apply(action));
    this.queue = execute.catch(() => {});
    return execute;
  }
  private async apply(action: Action): Promise<LessonView> {
    if (this.requests.has(action.requestId)) return this.snapshot();
    if (!['ask', 'pause', 'checkpoint'].includes(action.action) && action.revision !== this.state.revision) throw new InputError('畫面已更新，請再試一次。', 409);
    const active = this.state.beats.find(b => b.id === this.state.activeBeatId);
    switch (action.action) {
      case 'start':
        if (this.state.status !== 'idle') throw new InputError('課程已開始。', 409);
        this.generate('teach'); break;
      case 'next':
        if (this.state.status !== 'ready' || active?.kind !== 'lesson' || active.step !== this.state.step || active.cursor !== narrationLength(active)) throw new InputError('先讀完或繼續目前的片段。', 409);
        if (this.state.step + 1 >= (this.state.plan?.steps.length ?? 0)) { this.state.status = 'complete'; this.changed(); }
        else { await this.stop(); this.state.step++; this.state.selectedBeatId = active.id; this.generate('teach'); }
        break;
      case 'checkpoint':
        this.checkpoint(action); this.options.changed?.(this); return this.snapshot();
      case 'pause':
        this.checkpoint(action); await this.stop(); this.state.status = 'paused'; this.changed(); break;
      case 'ask': {
        if (!action.question) throw new InputError('請輸入想問的問題。');
        if (!this.state.plan) throw new InputError('老師還在安排步驟，請稍候再提問。', 409);
        const contextId = action.contextBeatId ?? action.beatId ?? this.state.activeBeatId;
        if (contextId && !this.state.beats.some(b => b.id === contextId)) throw new InputError('找不到指定的白板片段。');
        this.checkpoint(action);
        if (active?.kind === 'lesson' && active.step === this.state.step) this.savedBeatId = active.id;
        this.state.selectedBeatId = contextId;
        await this.stop();
        this.state.questions.push({ text: action.question, beatId: contextId });
        this.generate('clarify', action.question); break;
      }
      case 'resume': {
        if (!['paused', 'ready', 'error'].includes(this.state.status)) throw new InputError('目前還不能繼續。', 409);
        await this.stop(); this.state.error = null;
        const saved = this.state.beats.find(b => b.id === this.savedBeatId);
        const target = [saved, active].find(b => b?.kind === 'lesson' && b.step === this.state.step);
        if (target) {
          this.state.activeBeatId = target.id;
          this.state.status = target.cursor < narrationLength(target) ? 'playing' : 'ready';
          this.savedBeatId = null; this.changed();
        } else this.generate('teach');
        break;
      }
      case 'ack':
        if (!active || action.beatId !== active.id || this.state.status !== 'playing' || action.cursor !== narrationLength(active)) throw new InputError('片段已變更，忽略舊的播放完成通知。', 409);
        this.checkpoint(action); this.state.status = 'ready'; this.changed(); break;
      case 'retry':
        if (this.state.status !== 'error') throw new InputError('目前沒有需要重試的錯誤。', 409);
        await this.stop();
        // A provider can fail AFTER a valid tool committed. Preserve that beat, do not append a duplicate.
        if (active && active.id === this.lastCommittedId) { this.state.error = null; this.state.status = active.cursor < narrationLength(active) ? 'playing' : 'ready'; this.changed(); }
        else this.generate(this.lastIntent, this.lastQuestion);
        break;
    }
    this.requests.add(action.requestId);
    if (this.requests.size > 200) this.requests.delete(this.requests.values().next().value!);
    this.changed(); return this.snapshot();
  }
  async settled() { await this.task; }
  async dispose() { await this.stop(); this.session?.dispose(); }
  activeTools() { return this.session?.getActiveToolNames() ?? []; }
}
