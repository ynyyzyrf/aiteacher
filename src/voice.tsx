import { useEffect, useRef, useState } from 'react';
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onspeechstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void; abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export function VoiceInput({ enabled, interrupt, submit }: { enabled: boolean; interrupt: () => Promise<void>; submit: (text: string) => Promise<void> }) {
  const [listening, setListening] = useState(false); const [message, setMessage] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const starting = useRef(false); const mounted = useRef(true);
  const callbacks = useRef({ interrupt, submit });
  useEffect(() => { callbacks.current = { interrupt, submit }; }, [interrupt, submit]);
  const Ctor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; recognition.current?.abort(); }; }, []);
  useEffect(() => { if (!enabled && recognition.current) recognition.current.abort(); }, [enabled]);
  async function toggle() {
    if (recognition.current) { recognition.current.abort(); return; }
    if (!Ctor || !enabled || starting.current) return;
    setMessage('');
    // Half-duplex by design: stop board + playback before microphone capture to avoid teacher echo.
    starting.current = true;
    await callbacks.current.interrupt();
    starting.current = false;
    if (!mounted.current) return;
    const rec = new Ctor(); recognition.current = rec;
    rec.lang = 'zh-TW'; rec.continuous = false; rec.interimResults = true;
    let submitted = false;
    rec.onspeechstart = () => { /* Presentation already paused at explicit mic activation. */ };
    rec.onresult = event => {
      if (submitted) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim().slice(0, 1000);
          if (!text) continue;
          submitted = true; rec.abort(); void callbacks.current.submit(text); break;
        }
      }
    };
    rec.onerror = event => {
      if (event.error !== 'aborted') setMessage(event.error === 'not-allowed' ? '麥克風未獲允許，請用文字提問。' : '語音辨識無法完成，請用文字提問。');
      rec.abort();
    };
    rec.onend = () => { recognition.current = null; setListening(false); };
    try { rec.start(); setListening(true); }
    catch { recognition.current = null; setListening(false); setMessage('這個瀏覽器無法啟動語音辨識。'); }
  }
  return <><button type="button" disabled={!enabled || !Ctor} onClick={() => void toggle()}>{listening ? '停止收音' : '說話提問（實驗）'}</button><small>{Ctor ? '按下後暫停教學、收音一次。辨識可能由瀏覽器供應商處理；非全雙工即時語音。' : '此瀏覽器不支援語音辨識，請使用文字提問。'}</small>{message && <small role="alert">{message}</small>}</>;
}
