import { Info } from '@phosphor-icons/react';
import type { Health } from './useLearningRoom';
export function ModeStatus({ health }: { health: Health | null }) {
  return <details className="mode-status"><summary><span className={`status-dot ${health?.mode === 'fixture' ? 'offline' : ''}`}/>{health?.mode === 'fixture' ? '離線互動測試' : health?.modelAvailable ? 'Pi 教學' : '模型尚未設定'}<Info size={14}/></summary><div role="status"><strong>目前的學習模式</strong><p>{health?.message ?? '正在連接學習室…'}</p><small>教材與進度保存在本機服務的 .mag-lessons，閒置一小時後於清理時刪除；瀏覽器只保存本分頁課程識別碼。正式教學會將內容傳給已設定的模型供應商。語音是瀏覽器實驗功能，非全雙工即時模型。</small></div></details>;
}
