import { createRuntime, createTeacher, teachingTools } from '../server/pi.js';
import { sampleMaterial, verifyCitations } from '../server/material.js';
const mode = process.env.MAG_MODE === 'fixture' ? 'fixture' : 'live';
const runtime = await createRuntime(mode);
const available = await runtime.getAvailable();
console.log(JSON.stringify({ sdk: '@earendil-works/pi-coding-agent@1.0.2', mode, availableModels: available.length, selectedProvider: process.env.PI_PROVIDER ?? null, selectedModel: process.env.PI_MODEL ?? null }));
if (!available.length) {
  console.log('BLOCKED: no model credentials available to Pi. No model request made. Import and offline interaction tests remain available.');
  process.exitCode = 2;
} else {
  const material = await sampleMaterial();
  let plan = false, beat = false;
  const session = await createTeacher(runtime, teachingTools({
    plan: p => { p.steps.forEach(s => verifyCitations(material, s.citations)); plan = true; },
    beat: b => { verifyCitations(material, b.citations); beat = true; },
  }), mode, material);
  const timer = setTimeout(() => void session.abort(), 45000);
  try {
    console.log(JSON.stringify({ activeTools: session.getActiveToolNames() }));
    await session.prompt(JSON.stringify({ intent: 'teach', step: 0, instruction: '先 plan_lesson 再 board_beat 教第一小步，然後停止。', material: material.lines.map((text, i) => ({ line: i + 1, text })) }));
    console.log(JSON.stringify({ planToolExecuted: plan, boardToolExecuted: beat, verification: mode === 'fixture' ? 'REAL PI LOOP / MOCK MODEL' : 'LIVE MODEL' }));
    if (!plan || !beat) process.exitCode = 1;
  } finally { clearTimeout(timer); session.dispose(); }
}
