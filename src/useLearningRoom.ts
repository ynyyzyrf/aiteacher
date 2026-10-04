import { useCallback, useEffect, useRef, useState } from 'react';
import { narrationLength, type Action, type Beat, type LessonView } from '../shared/contracts';
export type Health = { mode: 'live' | 'fixture'; modelAvailable: boolean; message: string };
export async function api<T>(url: string, body?: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(url, body === undefined ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? '連線失敗，請再試一次。');
  return data as T;
}
export function useLearningRoom() {
  const [health, setHealth] = useState<Health | null>(null);
  const [lesson, setLesson] = useState<LessonView | null>(null);
  const current = useRef<LessonView | null>(null);
  const [view, setView] = useState<'home' | 'classroom'>('home');
  const [reviewStep, setReviewStep] = useState<number | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(() => window.innerWidth < 760);
  const [homeTab, setHomeTab] = useState<'home' | 'courses' | 'history'>('home');
  const [question, setQuestion] = useState(''); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const progressRef = useRef<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [speed, setSpeed] = useState(55);
  const locallyPaused = useRef(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const spoken = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const apply = useCallback((next: LessonView) => {
    if (current.current?.id === next.id && current.current.revision > next.revision) return;
    current.current = next; setLesson(next);
  }, []);
  const cancelSpeech = useCallback(() => { window.speechSynthesis?.cancel(); spoken.current = null; }, []);
  useEffect(() => { void api<Health>('/api/health').then(setHealth).catch(e => setError(e.message)); return cancelSpeech; }, [cancelSpeech]);
  useEffect(() => {
    if (!lesson?.id) return;
    const id = lesson.id;
    const timer = window.setInterval(() => { void api<LessonView>(`/api/lessons/${id}`).then(next => { if (current.current?.id === id) apply(next); }).catch(e => { locallyPaused.current = true; cancelSpeech(); setError(e.message); }); }, 400);
    return () => clearInterval(timer);
  }, [lesson?.id, apply, cancelSpeech]);
  const act = useCallback(async (action: Action['action'], extra: Partial<Action> = {}) => {
    const state = current.current;
    if (!state || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    if (['pause', 'ask'].includes(action)) { locallyPaused.current = true; cancelSpeech(); }
    try {
      const next = await api<LessonView>(`/api/lessons/${state.id}/actions`, { requestId: crypto.randomUUID(), revision: state.revision, action,
        beatId: state.activeBeatId, cursor: state.activeBeatId ? progressRef.current[state.activeBeatId] ?? state.beats.find(b => b.id === state.activeBeatId)?.cursor ?? 0 : 0, ...extra });
      apply(next); locallyPaused.current = action === 'pause';
      if (action === 'ask') { setQuestion(''); setReviewStep(null); }
      return next;
    } catch (e) { setError((e as Error).message); }
    finally { busyRef.current = false; setBusy(false); }
  }, [apply, cancelSpeech]);
  const active = lesson?.beats.find(b => b.id === lesson.activeBeatId);
  useEffect(() => {
    if (view !== 'classroom' || reviewStep !== null || !active || lesson?.status !== 'playing') return;
    const timer = window.setInterval(() => {
      if (locallyPaused.current || busyRef.current) return;
      const state = current.current;
      if (!state || state.activeBeatId !== active.id || state.status !== 'playing') return;
      const cursor = Math.max(progressRef.current[active.id] ?? 0, active.cursor);
      if (cursor >= narrationLength(active)) { void act('ack', { cursor: narrationLength(active) }); return; }
      const updated = { ...progressRef.current, [active.id]: cursor + 1 };
      progressRef.current = updated; setProgress(updated);
    }, speed);
    return () => clearInterval(timer);
  }, [active?.id, lesson?.status, act, speed, active, view, reviewStep]);
  // Optional browser playback: one utterance per visible beat, canceled on any interruption.
  // Board timing remains text-driven; speech boundary events are not assumed reliable.
  useEffect(() => {
    if (view !== 'classroom' || reviewStep !== null || !speakerOn || !active || lesson?.status !== 'playing' || locallyPaused.current || spoken.current === active.id) return;
    cancelSpeech(); spoken.current = active.id;
    const offset = progressRef.current[active.id] ?? active.cursor;
    const utterance = new SpeechSynthesisUtterance(Array.from(active.narration).slice(offset).join(''));
    utterance.lang = 'zh-TW'; utterance.rate = 0.95;
    utterance.onerror = event => { if (!['canceled', 'interrupted'].includes(event.error)) setError('朗讀無法播放，文字教學仍可繼續。'); };
    window.speechSynthesis.speak(utterance);
  }, [speakerOn, active, lesson?.status, cancelSpeech, view, reviewStep]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [active?.id, view]);
  async function importContent(body: unknown) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); cancelSpeech(); locallyPaused.current = true;
    try {
      const next = await api<LessonView>('/api/materials', body);
      const old = current.current;
      if (old) await fetch(`/api/lessons/${old.id}`, { method: 'DELETE' });
      progressRef.current = {}; setProgress({}); setSelected(null); setReviewStep(null); apply(next); locallyPaused.current = false; setView('classroom');
      return next;
    } catch (e) { setError((e as Error).message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function cursorFor(beat: Beat) { return Math.max(beat.cursor, progress[beat.id] ?? 0); }
  const canAsk = !!lesson?.plan && !busy;

  async function goHome() {
    if (busyRef.current) return;
    cancelSpeech();
    if (current.current && ['playing', 'generating', 'clarifying'].includes(current.current.status)) {
      const stopped = await act('pause'); if (!stopped) return;
    }
    locallyPaused.current = true; setReviewStep(null); setView('home');
  }
  function enterClassroom() { if (!current.current || busyRef.current) return; setReviewStep(null); setView('classroom'); }
  async function review(step: number | null) {
    const state = current.current; if (!state || busyRef.current) return;
    if (step !== null && (step < 0 || step > state.step)) return;
    cancelSpeech();
    if (['playing', 'generating', 'clarifying'].includes(state.status)) { const stopped = await act('pause'); if (!stopped) return; }
    locallyPaused.current = true; setReviewStep(step);
    if (step !== null) setSelected(state.beats.find(b => b.step === step && b.kind === 'lesson')?.id ?? null);
    else setSelected(null);
  }
  return { health, lesson, current, view, navCollapsed, setNavCollapsed, homeTab, setHomeTab, reviewStep, review, goHome, enterClassroom, question, setQuestion, error, setError, busy, selected, setSelected, sourcesOpen, setSourcesOpen, speed, setSpeed, speakerOn, setSpeakerOn, bottom, cancelSpeech, act, active, importContent, cursorFor, canAsk };
}
export type LearningRoom = ReturnType<typeof useLearningRoom>;
