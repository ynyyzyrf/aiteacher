import { visibleVisual, type Beat } from '../shared/contracts';
import { arrowHead } from './arrow-head';
export function BoardVisual({ beat, cursor }: { beat: Beat; cursor: number }) {
  const visual = visibleVisual(beat, cursor);
  if (visual.kind !== 'flow') {
    const text = visual.text;
    return visual.kind === 'code' ? <pre className="code-visual"><code>{text}<span className="pen">▏</span></code></pre> : <div className="text-visual">{text}<span className="pen">▏</span></div>;
  }
  const visible = visual.nodes.length;
  return <svg role="img" aria-label={visual.nodes.slice(0, visible).join(' → ')} viewBox="0 0 620 280" className="flow-visual">
    {visual.nodes.slice(0, visible).map((node, i) => {
      const x = 20 + (i % 2) * 310, y = 20 + Math.floor(i / 2) * 140;
      const points = [x + 245, y + 45, x + 295, y + 45];
      return <g key={i} className="draw-in"><rect x={x} y={y} width="240" height="85" rx="14"/><foreignObject x={x + 10} y={y + 10} width="220" height="65"><div className="flow-label">{node}</div></foreignObject>{i % 2 === 0 && i + 1 < visible && <><polyline points={points.join(' ')}/><polyline points={arrowHead(points, 10)?.join(' ')}/></>}</g>;
    })}
  </svg>;
}
