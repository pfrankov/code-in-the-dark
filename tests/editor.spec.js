import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Set only the name: reloads must keep the content written by the app.
  await page.addInitScript(() => sessionStorage.setItem('name', 'Test participant'));
  page.on('dialog', dialog => dialog.accept());
});

async function openEditor(page) {
  await page.goto('/?lang=en');
  await expect(page.locator('.name-tag')).toHaveText('Test participant');
  await page.locator('.ace_text-input').focus();
}

async function editorValue(page) {
  return page.evaluate(() => window.ace.edit('editor').getValue());
}

async function changeListenerCount(page) {
  // Ace includes its own listeners. Compare with a fresh editor instead of
  // asserting a private implementation-specific absolute count.
  return page.evaluate(() => window.ace.edit('editor').session._eventRegistry.change.length);
}

test('restoring content and reloading do not add change listeners or score', async ({ page }) => {
  await openEditor(page);
  const freshCount = await changeListenerCount(page);
  await page.evaluate(() => sessionStorage.setItem('content', 'x'));

  for (let reload = 0; reload < 3; reload++) {
    await page.reload();
    await expect(page.locator('.name-tag')).toHaveText('Test participant');
    await expect.poll(() => editorValue(page)).toBe('x');
    expect(await changeListenerCount(page)).toBe(freshCount);
    await expect(page.locator('.counter')).toHaveText('0');
  }
});

test('autosave waits 300 ms and keeps edits and deletions across reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await openEditor(page);
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
  await page.keyboard.insertText('first\nsecond');
  await page.clock.runFor(299);
  expect(await page.evaluate(() => sessionStorage.getItem('content'))).toBeNull();
  await page.clock.runFor(1);
  expect(await page.evaluate(() => sessionStorage.getItem('content'))).toBe('first\nsecond');

  await page.reload();
  await expect(page.locator('.name-tag')).toHaveText('Test participant');
  expect(await editorValue(page)).toBe('first\nsecond');
  await page.locator('.ace_text-input').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await page.clock.runFor(300);
  expect(await page.evaluate(() => sessionStorage.getItem('content'))).toBe('');
  await page.reload();
  await expect(page.locator('.name-tag')).toHaveText('Test participant');
  expect(await editorValue(page)).toBe('');
});

test('typing keeps the 50 ms score gate and ignores deletion and multiline paste', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await openEditor(page);
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
  await page.keyboard.type('a');
  await expect(page.locator('.counter')).toHaveText('1');
  await page.clock.runFor(49);
  await page.keyboard.type('b');
  await expect(page.locator('.counter')).toHaveText('1');
  await page.clock.runFor(1);
  await page.keyboard.type('c');
  await expect(page.locator('.counter')).toHaveText('2');
  await page.clock.runFor(50);
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText('line one\nline two');
  await expect(page.locator('.counter')).toHaveText('2');
});
