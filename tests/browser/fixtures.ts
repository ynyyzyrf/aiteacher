import { test as base, expect } from '@playwright/test';
// Durable lessons must not leak between repeated browser suites or consume the 20-lesson limit.
export const test = base.extend<{ lessonCleanup: void }>({
  lessonCleanup: [async ({ page, request }, use) => {
    const ids = new Set<string>();
    const pending: Promise<void>[] = [];
    page.on('response', response => {
      if (response.url().endsWith('/api/materials') && response.status() === 201) {
        pending.push(response.json().then(data => { ids.add(data.id); }).catch(() => {}));
      }
    });
    await use();
    await Promise.all(pending);
    for (const id of ids) await request.delete(`/api/lessons/${id}`);
  }, { auto: true }],
});
export { expect };
