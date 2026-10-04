import { test, expect } from '@playwright/test';
test('imports sample, reveals board progressively, interrupts, clarifies and resumes', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByText('離線互動測試', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'docs/evidence/import-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /從零理解 TypeScript/ }).click();
  await page.getByRole('button', { name: /教材與來源/ }).click();
  await expect(page.getByText(/SHA-256/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Everyday Types' })).toHaveAttribute('href', /typescriptlang/);
  await page.getByRole('button', { name: /關閉教材與來源/ }).click();
  await page.getByRole('button', { name: '開始這一小節' }).click();
  await expect(page.getByTestId('board-beat')).toHaveCount(1);
  await expect(page.getByTestId('narration').first()).not.toBeEmpty();
  const before = await page.getByTestId('narration').first().textContent();
  await page.getByRole('button', { name: '這裡不懂，換個方式說' }).click();
  await expect(page.getByTestId('board-beat')).toHaveCount(2);
  const stopped = await page.getByTestId('narration').first().textContent();
  expect(stopped!.length).toBeGreaterThanOrEqual(before!.length);
  await page.waitForTimeout(250);
  expect(await page.getByTestId('narration').first().textContent()).toBe(stopped);
  await page.getByLabel('書寫速度').selectOption('12');
  await expect(page.getByRole('button', { name: '接著剛才的位置' })).toBeVisible();
  await page.screenshot({ path: 'docs/evidence/clarification-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '接著剛才的位置' }).click();
  await expect(page.getByRole('button', { name: '我懂了，下一步' })).toBeVisible();
  await expect(page.getByTestId('board-beat')).toHaveCount(2);
  await page.getByRole('button', { name: '我懂了，下一步' }).click();
  await expect(page.getByTestId('board-beat')).toHaveCount(1);
  await expect(page.getByTestId('board-beat').last()).toContainText('STEP 2');
  expect(errors).toEqual([]);
});
test('uploads real Markdown, handles invalid imports and renders markup as literal text', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('上傳教材').setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toContainText('64 KB 以下');
  const text = '植物透過光合作用利用光能，水與二氧化碳參與反應，形成有機物。\n<script>window.injected = true</script> 這一行是教材原文，必須當成文字顯示，不能執行其中的程式。';
  await page.getByLabel('上傳教材').setInputFiles({ name: '植物.md', mimeType: 'text/markdown', buffer: Buffer.from(text) });
  await page.getByRole('button', { name: '建立我的課程' }).click();
  await expect(page.getByText('植物.md', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '開始這一小節' }).click();
  await page.getByLabel('書寫速度').selectOption('12');
  await expect(page.getByRole('button', { name: '我懂了，下一步' })).toBeVisible();
  await expect(page.getByTestId('board-beat').first()).toContainText('光合作用');
  await page.getByRole('button', { name: '我懂了，下一步' }).click();
  await expect(page.getByRole('button', { name: '完成這一小節' })).toBeVisible();
  await expect(page.getByTestId('board-beat').last()).toContainText('<script>');
  expect(await page.evaluate(() => 'injected' in window)).toBe(false);
});
test('mobile keeps question entry usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /從零理解 TypeScript/ }).click();
  await expect(page.getByLabel('問問老師')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/evidence/mobile.png', fullPage: true });
});
test('network failure stops presentation and reports a useful error', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: /從零理解 TypeScript/ }).click();
  await page.getByRole('button', { name: '開始這一小節' }).click();
  await expect(page.getByTestId('board-beat')).toHaveCount(1);
  await page.route('**/api/lessons/*', route => route.abort('failed'));
  await expect(page.getByRole('alert')).toBeVisible();
  const frozen = await page.getByTestId('narration').textContent();
  await page.waitForTimeout(200);
  expect(await page.getByTestId('narration').textContent()).toBe(frozen);
});
test('browser voice bridge pauses board, submits one final transcript, and handles permission denial (mock audio)', async ({ page }) => {
  await page.addInitScript(() => {
    class MockRecognition {
      static latest: MockRecognition;
      onresult?: (e: unknown) => void; onend?: () => void; onerror?: (e: unknown) => void;
      constructor() { MockRecognition.latest = this; }
      start() { /* Browser API double; no microphone or recognition service contacted. */ }
      abort() { this.onend?.(); }
    }
    Object.assign(window, { SpeechRecognition: MockRecognition, webkitSpeechRecognition: MockRecognition, MockRecognition });
    const audio = { speaks: 0, cancels: 0, lastText: '', speak(u: SpeechSynthesisUtterance) { this.speaks++; this.lastText = u.text; }, cancel() { this.cancels++; } };
    Object.defineProperty(window, 'speechSynthesis', { value: audio });
  });
  await page.goto('/'); await page.getByRole('button', { name: /從零理解 TypeScript/ }).click();
  await page.getByRole('button', { name: '開始這一小節' }).click();
  await expect(page.getByTestId('board-beat')).toHaveCount(1);
  await page.getByText('聲音設定與功能狀態', { exact: true }).click();
  await page.getByRole('button', { name: '開啟朗讀（實驗）' }).click();
  await expect.poll(() => page.evaluate(() => (window.speechSynthesis as unknown as { speaks: number }).speaks)).toBeGreaterThan(0);
  const cancelCount = await page.evaluate(() => (window.speechSynthesis as unknown as { cancels: number }).cancels);
  await page.getByRole('button', { name: '說話提問（實驗）' }).click();
  await expect(page.getByRole('button', { name: '停止收音' })).toBeVisible();
  expect(await page.evaluate(() => (window.speechSynthesis as unknown as { cancels: number }).cancels)).toBeGreaterThan(cancelCount);
  const frozen = await page.getByTestId('narration').textContent();
  await page.waitForTimeout(200); expect(await page.getByTestId('narration').textContent()).toBe(frozen);
  await page.evaluate(() => {
    const w = window as unknown as { MockRecognition: { latest: { onresult: (e: unknown) => void } } };
    const event = { resultIndex: 0, results: [{ isFinal: true, 0: { transcript: '這裡不懂' } }] };
    w.MockRecognition.latest.onresult(event); w.MockRecognition.latest.onresult(event);
  });
  await expect(page.getByTestId('board-beat')).toHaveCount(2);
  await expect(page.locator('.question-bubble')).toHaveCount(1);
  await page.getByRole('button', { name: '說話提問（實驗）' }).click();
  await expect(page.getByRole('button', { name: '停止收音' })).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { MockRecognition: { latest: { onerror: (e: unknown) => void } } };
    w.MockRecognition.latest.onerror({ error: 'not-allowed' });
  });
  await expect(page.getByText('麥克風未獲允許，請用文字提問。')).toBeVisible();
});
test('renders constrained code and vector drawing progressively (injected board fixture)', async ({ page }) => {
  let visual: { kind: 'code'; text: string } | { kind: 'flow'; nodes: string[] } = { kind: 'code', text: 'let score: number = 3;' };
  await page.route('**/api/lessons/**', async route => {
    const response = await route.fetch();
    const data = await response.json();
    if (data.beats?.[0]) data.beats[0].visual = visual;
    await route.fulfill({ response, json: data });
  });
  await page.goto('/'); await page.getByRole('button', { name: /從零理解 TypeScript/ }).click();
  await page.getByRole('button', { name: '開始這一小節' }).click();
  await page.getByLabel('書寫速度').selectOption('12');
  await expect(page.locator('.code-visual')).toContainText('let score: number = 3;');
  visual = { kind: 'flow', nodes: ['教材', 'Pi 教學', '白板'] };
  await expect(page.getByRole('img', { name: '教材 → Pi 教學 → 白板' })).toBeVisible();
  await expect(page.locator('svg rect')).toHaveCount(3);
  await expect(page.locator('svg polyline')).toHaveCount(2);
});
