import { ArrowLeft, ArrowRight, BookOpen, CaretLeft, CaretRight, ChatCircleDots, CheckCircle, FileText, Info, Pause, Play, Robot, X } from '@phosphor-icons/react';
import { visibleNarration } from '../shared/contracts';
import { BoardVisual } from './BoardVisual';
import { ModeStatus } from './ModeStatus';
import { VoiceInput } from './voice';
import type { LearningRoom } from './useLearningRoom';
const statusNames = { idle: '準備開始', generating: '老師正在安排這一步…', playing: '正在寫白板', paused: '已暫停，停在這裡', ready: '換你想一想', clarifying: '老師正在釐清這個地方…', error: '回應已停止', complete: '這一小節完成了' };
export function Classroom({ room }: { room: LearningRoom }) {
  const { lesson, active, selected, setSelected, reviewStep, busy, act, cursorFor, canAsk } = room;
  if (!lesson) return null;
  const shownStep = reviewStep ?? lesson.step;
  const shownBeats = lesson.beats.filter(b => b.step === shownStep);
  const currentTitle = lesson.plan?.steps[shownStep]?.title ?? '從一個小觀念開始';
  const total = lesson.plan?.steps.length ?? 0;
  const progress = total ? Math.round((lesson.step + (lesson.status === 'complete' ? 1 : 0)) / total * 100) : 0;
  const resume = () => { void room.review(null).then(() => act('resume')); };
  const Controls = () => {
    return <>
      {reviewStep !== null ? <button className="primary playback-primary" disabled={busy} onClick={resume}><Play size={17} weight="fill"/>回到目前進度</button> : <>
        {lesson.status === 'idle' && <button className="primary playback-primary" disabled={busy} onClick={() => void act('start')}><Play size={17} weight="fill"/>開始這一小節</button>}
        {['playing', 'generating', 'clarifying'].includes(lesson.status) && <button className="primary playback-primary" disabled={busy} onClick={() => void act('pause')}><Pause size={17} weight="fill"/>暫停</button>}
        {(lesson.status === 'paused' || (lesson.status === 'ready' && active?.kind === 'clarification')) && <button className="primary playback-primary" disabled={busy} onClick={() => void act('resume')}><Play size={17} weight="fill"/>接著剛才的位置</button>}
        {lesson.status === 'ready' && active?.kind === 'lesson' && <button className="primary playback-primary" disabled={busy} onClick={() => { room.cancelSpeech(); void act('next'); }}>{lesson.step + 1 === total ? '完成這一小節' : '我懂了，下一步'}<ArrowRight size={17}/></button>}
        {lesson.status === 'error' && <button className="primary playback-primary" disabled={busy} onClick={() => void act('retry')}>重試這一步<ArrowRight size={17}/></button>}
        {lesson.status === 'complete' && <button className="primary playback-primary" disabled={busy} onClick={() => void room.goHome()}>回到學習首頁<CheckCircle size={17}/></button>}
      </>}
    </>;
  }
  return <div className="classroom-shell" data-testid="classroom-view">
    <header className="classroom-topbar"><button className="back-home" onClick={() => void room.goHome()} disabled={busy}><ArrowLeft size={19}/><span>學習首頁</span></button><span className="topbar-divider"/><div className="course-breadcrumb"><BookOpen size={19}/><span>{lesson.material.name}</span></div><ModeStatus health={room.health}/></header>
    <div className="classroom-layout">
      <main className="lesson-main">
        <div className="lesson-overview"><div><div className="lesson-eyebrow">{reviewStep !== null ? '回顧已學內容' : '跟著你的節奏'}<span>·</span>{total ? `第 ${shownStep + 1} 步，共 ${total} 步` : '準備你的第一小步'}</div><h1>{currentTitle}</h1></div><button className="source-toggle" onClick={() => room.setSourcesOpen(true)}><FileText size={17}/>教材與來源</button></div>
        <div className="lesson-progress" aria-label="課程進度"><div><span style={{ width: `${progress}%` }}/></div><span>{progress}%</span></div>
        {lesson.plan && <nav className="step-pills" aria-label="學習步驟">{lesson.plan.steps.map((step, i) => <button disabled={i > lesson.step || busy} className={i === shownStep ? 'current' : i < lesson.step ? 'done' : ''} onClick={() => void room.review(i === lesson.step ? null : i)} key={i} aria-label={`第 ${i + 1} 步：${step.title}`} aria-current={i === shownStep ? 'step' : undefined}>{i < lesson.step ? <CheckCircle size={15} weight="fill"/> : <span>{i + 1}</span>}<span>{step.title}</span></button>)}</nav>}
        {lesson.budget?.warning && <div role="status" className="error">本課程已使用至少 80% 的估算用量預算。已預留 {lesson.budget.used}／{lesson.budget.limit}；供應商回報 {lesson.budget.reported} tokens。不是費用上限。</div>}
        {(room.error || lesson.error) && <div className="error" role="alert">{room.error || lesson.error}{room.error && <button className="icon-button" aria-label="關閉錯誤" onClick={() => room.setError('')}><X size={16}/></button>}</div>}
        <section className="whiteboard" aria-label="動態白板"><div className="board-top"><span><span className="status-dot"/>{reviewStep !== null ? '回顧中 · 不會改變課程進度' : statusNames[lesson.status]}</span><span>你的思考白板</span></div>
          {shownBeats.length === 0 && <div className="board-empty"><BookOpen size={38} weight="duotone"/><h2>{lesson.status === 'idle' ? '準備好，從第一個「為什麼」開始。' : '把一個大觀念，拆成小小幾步。'}</h2><p>{lesson.status === 'idle' ? '教材已經就位。老師會先安排步驟，再邊寫邊說明。' : '老師正在整理教材，你隨時可以暫停。'}</p>{lesson.material.learningGoal && <div className="learner-goal"><small>你的學習目標</small>{lesson.material.learningGoal}</div>}</div>}
          {shownBeats.map(beat => <article key={beat.id} className={`beat ${beat.kind} ${selected === beat.id ? 'selected' : ''}`} data-testid="board-beat" data-beat-id={beat.id} onClick={() => setSelected(beat.id)}><button className="beat-label" onClick={() => setSelected(beat.id)} aria-pressed={selected === beat.id}>{beat.kind === 'clarification' ? <ChatCircleDots size={15}/> : <BookOpen size={15}/>}<span>{beat.kind === 'clarification' ? '把這裡說清楚' : `STEP ${beat.step + 1}`}</span><span className="beat-action">{selected === beat.id ? '正在問這裡' : '點選問這裡'}</span></button><BoardVisual beat={beat} cursor={cursorFor(beat)}/><p className="narration" data-testid="narration">{visibleNarration(beat, cursorFor(beat))}</p><details className="citations" onClick={e => e.stopPropagation()}><summary>教材依據 · {beat.citations.map(c => `L${c.start}–${c.end}`).join('、')}</summary>{beat.citations.map((c, i) => <blockquote key={i}>{c.quote}</blockquote>)}</details></article>)}<div ref={room.bottom}/>
        </section>
        <div className="lesson-playback"><button className="review-button" disabled={busy || shownStep === 0} onClick={() => void room.review(shownStep - 1)}><CaretLeft size={17}/><span>上一步</span></button><Controls/><button className="review-button" disabled={busy || reviewStep === null || shownStep >= lesson.step} onClick={() => void room.review(shownStep + 1 === lesson.step ? null : shownStep + 1)}><span>下一頁</span><CaretRight size={17}/></button></div>
        <div className="lesson-bottom-note"><span>先理解，再往前。隨時可以打斷老師。</span><label>書寫速度<select aria-label="書寫速度" value={room.speed} onChange={e => room.setSpeed(Number(e.target.value))}><option value={85}>慢慢來</option><option value={55}>剛剛好</option><option value={12}>快速閱讀</option></select></label></div>
      </main>
      <aside className="teacher-panel" aria-label="老師與情境提問"><div className="teacher-stage"><div className="teacher-caption"><span className="status-dot"/>你的 AI 學習夥伴<span>靜態角色</span></div><div className="teacher-portrait" aria-label="MAG AI 老師靜態圖示"><Robot size={92} weight="duotone"/></div><div className="teacher-stage-copy"><strong>MAG 老師</strong><span>{lesson.status === 'clarifying' ? '我們換個方式，慢慢說。' : '不用急，我們一起把它學懂。'}</span></div></div>
        <div className="teacher-conversation"><div className="conversation-heading"><ChatCircleDots size={18}/><h2>隨時問，不用等下課</h2></div><div className="teacher-greeting"><p>我是你的學習夥伴。哪裡卡住了？點一下白板，再說「這裡不懂」就好。</p></div><div className="context-chip"><BookOpen size={14}/><span>{selected ? '正在問你選取的白板片段' : total ? `跟著第 ${lesson.step + 1} 步：${lesson.plan?.steps[lesson.step]?.title}` : '開始教學後，這裡會跟著你的進度'}</span>{selected && <button aria-label="回到目前的講解" onClick={() => setSelected(null)}><X size={13}/></button>}</div>
          <button className="quick-question" disabled={!canAsk} onClick={() => void act('ask', { question: '這裡不懂', contextBeatId: selected ?? active?.id })}><ChatCircleDots size={16}/>這裡不懂，換個方式說</button>
          <div className="question-history" aria-label="我的問題">{lesson.questions.map((q, i) => <div className="question-bubble" key={i}><small>你問</small>{q.text}</div>)}{active?.kind === 'clarification' && <div className="teacher-answer"><small>MAG 老師</small>{visibleNarration(active, cursorFor(active))}</div>}</div>
        </div>
        <form className="question-form" onSubmit={e => { e.preventDefault(); if (room.question.trim()) void act('ask', { question: room.question, contextBeatId: selected ?? active?.id }); }}><label htmlFor="question" className="sr-only">問問老師</label><textarea id="question" rows={3} maxLength={1000} value={room.question} onChange={e => room.setQuestion(e.target.value)} placeholder="問問老師，例如：這裡可以再說一次嗎？" disabled={!lesson.plan}/><div className="send-row"><small>提問會暫停講解</small><button className="primary" disabled={!canAsk || !room.question.trim()} type="submit">送出<ArrowRight size={16}/></button></div></form>
        <details className="voice-settings"><summary><Info size={14}/>聲音設定與功能狀態</summary><div className="voice-options"><VoiceInput enabled={!!lesson.plan} interrupt={() => act('pause').then(() => {})} submit={text => act('ask', { question: text, contextBeatId: selected ?? room.current.current?.activeBeatId }).then(() => {})}/><button disabled={!('speechSynthesis' in window)} onClick={() => { room.cancelSpeech(); room.setSpeakerOn(!room.speakerOn); }}>{room.speakerOn ? '關閉朗讀' : '開啟朗讀（實驗）'}</button><small>MVP：朗讀目前片段，提問或暫停即停止。單次收音是實驗功能，非全雙工即時音訊。文字白板和聲音各自播放；提問會一起停止。真實音訊與精準同步尚未驗證。</small></div></details>
      </aside>
    </div>
    {room.sourcesOpen && <div className="modal-backdrop"><section className="sources-modal" role="dialog" aria-modal="true" aria-labelledby="sources-title"><div className="section-heading"><div><span className="eyebrow">LEARNING MATERIAL</span><h2 id="sources-title">教材與來源</h2></div><button className="icon-button" aria-label="關閉教材與來源" onClick={() => room.setSourcesOpen(false)}><X size={22}/></button></div><p>{lesson.material.origin === 'sample' ? '依官方文件整理的筆記；非官方翻譯' : '使用者提供；尚未外部查證'}</p>{lesson.material.sources.map(s => <a href={s.url} target="_blank" rel="noreferrer" key={s.url}>{s.title}<ArrowRight size={13}/></a>)}<small className="source-hash">SHA-256：{lesson.material.sha256}</small><ol>{lesson.material.lines.map((line, i) => <li key={i}>{line || ' '}</li>)}</ol></section></div>}
  </div>;
}
