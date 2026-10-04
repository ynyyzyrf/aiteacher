import { useRef, useState } from 'react';
import { ArrowRight, ArrowUp, BookOpen, CaretRight, Check, ClockCounterClockwise, FileText, House, Paperclip, Plus, SidebarSimple, Sparkle, X } from '@phosphor-icons/react';
import type { LearningRoom } from './useLearningRoom';
import { ModeStatus } from './ModeStatus';
type DraftMaterial = { name: string; text: string; origin: 'upload' | 'paste' };
const prompts = ['我的 JavaScript 基礎不太穩，想從零理解 TypeScript。', '用小例子帶我看懂變數、參數與回傳值。', '型別標註和型別推斷有什麼不同？'];
export function Home({ room }: { room: LearningRoom }) {
  const { navCollapsed: collapsed, setNavCollapsed: setCollapsed, homeTab: tab, setHomeTab: setTab } = room;
  const [goal, setGoal] = useState(''); const [draft, setDraft] = useState<DraftMaterial | null>(null);
  const [sample, setSample] = useState(false); const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState(''); const [pasteName, setPasteName] = useState('我的學習筆記');
  const upload = useRef<HTMLInputElement>(null); const composer = useRef<HTMLTextAreaElement>(null);
  const { lesson, busy, error, setError } = room;
  async function chooseFile(file?: File) {
    if (!file) return;
    if (file.size > 65536 || !/\.(md|txt)$/i.test(file.name)) { setError('請選擇 64 KB 以下的 .txt 或 .md 教材。'); return; }
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if (text.trim().length < 40) { setError('教材至少需要 40 字。'); return; }
      setDraft({ name: file.name, text, origin: 'upload' }); setSample(false); setError('');
    } catch { setError('無法讀取教材，請使用 UTF-8 編碼的文字檔。'); }
  }
  function usePrompt(prompt: string) { setGoal(prompt); setSample(true); setDraft(null); setTab('home'); composer.current?.focus(); }
  function attachPaste() {
    if (paste.trim().length < 40 || !pasteName.trim()) { setError('請填寫教材名稱，並貼上至少 40 字的內容。'); return; }
    setDraft({ name: pasteName.trim(), text: paste, origin: 'paste' }); setSample(false); setPasteOpen(false); setError('');
  }
  async function start() {
    if (!sample && !draft) { setError('先附上教材，或選用下方 TypeScript 官方手冊導讀。'); return; }
    await room.importContent(sample ? { sample: true, learningGoal: goal } : { ...draft, learningGoal: goal });
  }
  const progress = lesson?.plan ? Math.round(lesson.step / lesson.plan.steps.length * 100) : 0;
  return <div className={`home-shell ${collapsed ? 'nav-collapsed' : ''}`} data-testid="home-view">
            <input ref={upload} className="sr-only" aria-label="上傳教材" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ''; }}/>
    {!collapsed && <button className="nav-backdrop" aria-label="關閉側邊欄" onClick={() => setCollapsed(true)}/>}
    <aside className="home-nav" aria-label="主選單">
      <div className="nav-brand"><a href="#home" onClick={e => { e.preventDefault(); setTab('home'); }} aria-label="MAG 首頁"><Sparkle size={30} weight="fill"/><span>MAG<span className="brand-period">.</span></span></a><button className="icon-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? '展開側邊欄' : '收合側邊欄'} aria-expanded={!collapsed}><SidebarSimple size={20}/></button></div>
      <button className="new-course" onClick={() => { setTab('home'); composer.current?.focus(); }}><Plus size={19}/><span>建立課程</span></button>
      <nav>{([{ key: 'home', label: '首頁', icon: House }, { key: 'courses', label: '我的學習', icon: BookOpen }, { key: 'history', label: '本次紀錄', icon: ClockCounterClockwise }] as const).map(item => <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)} aria-label={item.label} aria-current={tab === item.key ? 'page' : undefined}><item.icon size={21} weight={tab === item.key ? 'fill' : 'regular'}/><span>{item.label}</span></button>)}</nav>
      <div className="nav-note"><span>你的學習空間</span><small>一次弄懂一小步</small></div>
      <div className="nav-profile"><span className="profile-initial">M</span><div><strong>MAG 的學習室</strong><small>本機個人空間</small></div></div>
    </aside>
    <div className="home-content"><header className="home-topbar"><span>為好奇心，留一點時間。</span><ModeStatus health={room.health}/></header>
      <main className="home-main">
        {error && <div className="error" role="alert">{error}<button className="icon-button" aria-label="關閉錯誤" onClick={() => setError('')}><X size={16}/></button></div>}
        {tab === 'home' && <section className="home-hero">
          <div className="hero-kicker"><Sparkle size={17} weight="fill"/> YOUR PERSONAL LEARNING SPACE</div>
          <h1>讓好奇心，<br className="mobile-break"/>變成你的下一堂課。</h1><p>告訴老師想學什麼，帶上你的教材。剩下的，我們一步步來。</p>
          <form className="goal-composer" onSubmit={e => { e.preventDefault(); void start(); }}>
            <label htmlFor="learning-goal" className="sr-only">學習目標</label><textarea ref={composer} id="learning-goal" rows={3} maxLength={500} value={goal} onChange={e => setGoal(e.target.value)} placeholder="我想學 TypeScript，但 JavaScript 基礎不太穩…"/>
            {(draft || sample) && <div className="attached-material"><FileText size={17}/><span>{sample ? 'TypeScript 官方手冊導讀' : draft?.name}</span><span className="attachment-state"><Check size={13}/>已附上</span><button type="button" aria-label="移除教材" onClick={() => { setDraft(null); setSample(false); }}><X size={14}/></button></div>}
            <div className="composer-bottom"><div><button type="button" className="attach-button" onClick={() => upload.current?.click()}><Paperclip size={19}/>附上教材</button><button type="button" className="paste-button" onClick={() => setPasteOpen(true)}>貼上筆記</button></div><button className="composer-submit" type="submit" aria-label="建立我的課程" disabled={busy || (!sample && !draft)}><span>建立我的課程</span><ArrowUp size={21}/></button></div>
          </form>
          <div className="composer-hint"><span>支援 TXT、Markdown · UTF-8 · 64 KB 以內</span><span>先有教材，教學才有依據</span></div>
          <div className="sample-prompts" aria-label="學習目標範例"><span>還沒想好？試試</span>{prompts.map((prompt, i) => <button key={prompt} onClick={() => usePrompt(prompt)}>{['從零學 TypeScript', '補好 JavaScript 基礎', '看懂型別推斷'][i]}<ArrowRight size={13}/></button>)}</div>
        </section>}
        {tab !== 'history' && <section className="learning-cards" aria-labelledby="learning-heading"><div className="section-heading"><div><span className="eyebrow">LEARN AT YOUR OWN PACE</span><h2 id="learning-heading">{lesson ? '接著上次的好奇心' : tab === 'courses' ? '從第一份教材開始' : '從一個小觀念開始'}</h2></div><span className="section-caption">{lesson ? '只顯示這次實際建立的課程' : '有來源的小課，隨時開始'}</span></div>
          <div className="course-grid">
            {lesson && <button className="course-card continue-card" onClick={room.enterClassroom} disabled={busy}><div className="course-cover"><BookOpen size={56} weight="duotone"/><span className="cover-tag">本次學習</span></div><div className="course-copy"><span className="course-category">繼續學習</span><h3>{lesson.material.name}</h3><p>{lesson.plan ? lesson.plan.steps[lesson.step]?.title : '教材已準備好，從第一步開始。'}</p><div className="course-progress"><span style={{ width: `${lesson.status === 'complete' ? 100 : progress}%` }}/></div><div className="course-card-footer"><span>{lesson.plan ? `第 ${lesson.step + 1} / ${lesson.plan.steps.length} 步` : '已匯入教材'}</span><span>回到教室 <ArrowRight size={15}/></span></div></div></button>}
            <button className="course-card sample-course" disabled={busy} onClick={() => void room.importContent({ sample: true, learningGoal: prompts[0] })}><div className="course-cover"><span className="ts-cover-type">Type<span>Script</span></span><span className="cover-tag">教材範例</span></div><div className="course-copy"><span className="course-category">程式入門 · 基礎友善</span><h3>從零理解 TypeScript</h3><p>先認識值與變數，再慢慢看懂型別。依官方手冊整理。</p><div className="course-card-footer"><span>來源可追溯</span><span>開始學習 <ArrowRight size={15}/></span></div></div></button>
            <button className="course-card own-material-card" onClick={() => { setTab('home'); upload.current?.click(); }}><div className="course-cover"><FileText size={68} weight="duotone"/><Paperclip size={32}/><span className="cover-tag">你的教材</span></div><div className="course-copy"><span className="course-category">筆記、文章或課堂講義</span><h3>把想懂的，帶進來。</h3><p>匯入自己的文字教材，讓老師從你的問題開始。</p><div className="course-card-footer"><span>TXT / Markdown</span><span>選擇教材 <Plus size={15}/></span></div></div></button>
          </div><p className="session-note">目前課程只保留在這次使用期間；重新整理或重啟服務不會恢復進度。</p>
        </section>}
        {tab === 'history' && <section className="session-history"><span className="eyebrow">THIS LEARNING SESSION</span><h1>本次學習紀錄</h1>{lesson ? <><button className="history-course" onClick={room.enterClassroom}><BookOpen size={24}/><span>{lesson.material.name}<small>{lesson.beats.filter(b => b.kind === 'lesson').length} 個教學片段 · {lesson.questions.length} 個問題</small></span><CaretRight size={20}/></button>{lesson.questions.length ? <ol>{lesson.questions.map((q, i) => <li key={i}><small>問題 {i + 1}</small>{q.text}</li>)}</ol> : <p className="empty-history">還沒有提問。上課時隨時可以說「這裡不懂」。</p>}</> : <div className="empty-history"><ClockCounterClockwise size={40}/><h2>每個「為什麼」，都值得留下。</h2><p>你還沒開始本次學習。建立一堂課後，實際提問會出現在這裡。</p><button onClick={() => setTab('home')}>回首頁開始 <ArrowRight size={16}/></button></div>}</section>}
      </main><footer className="home-footer">MAG 學習室 <span>小步學習，慢慢長大。</span></footer>
    </div>
    {pasteOpen && <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="paste-title" className="paste-modal"><div className="section-heading"><h2 id="paste-title">貼上你的教材</h2><button className="icon-button" aria-label="關閉貼上筆記" onClick={() => setPasteOpen(false)}><X size={21}/></button></div><label>教材名稱<input value={pasteName} onChange={e => setPasteName(e.target.value)} maxLength={120}/></label><label>教材內容<textarea aria-label="教材內容" value={paste} onChange={e => setPaste(e.target.value)} rows={9} maxLength={40000} placeholder="貼上至少 40 字的學習材料…" autoFocus/></label><p>只會作為教學資料，不會執行內容中的程式或指令。</p><button className="primary" onClick={attachPaste}>加入教材 <Paperclip size={17}/></button></section></div>}
  </div>;
}
