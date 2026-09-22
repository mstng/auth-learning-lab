import { test, expect, type Page } from '@playwright/test';

async function readRecords(page: Page) {
  const next = page.getByRole('button', { name: '記録の次へ', exact: true });
  await expect(next).toBeVisible();
  for (let i = 0; i < 8 && await next.isVisible(); i++) await next.click();
}
async function run(page: Page, button: string, operation: string, choice = 'まだわからない') {
  await page.getByRole('radio', { name: choice, exact: true }).check();
  const request = page.waitForResponse(r => r.url().endsWith(`/api/tokens/${operation}`));
  await page.getByRole('button', { name: button, exact: true }).click({ timeout: 22000 });
  const result = await (await request).json();
  await expect(page.locator('.tokens-outcome')).toBeVisible();
  await readRecords(page);
  return result;
}
const nextQuestion = (page: Page) => page.getByRole('button', { name: '次の問いへ', exact: true }).click();

test('eight prediction questions prove expiry, renewal and reuse with actual tokens and DB records', async ({ page, context }) => {
  test.setTimeout(65000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let profiles = 0; page.on('request', r => { if (r.url().endsWith('/api/tokens/profile')) profiles++; });
  await page.goto('/tokens'); await page.getByRole('button', { name: '更新ガイドを始める' }).click();
  await expect(page.getByRole('button', { name: '2種類を発行する', exact: true })).toBeDisabled();
  const issue = await run(page, '2種類を発行する', 'issue', '両方のトークンがそのまま残る'), a = issue.pair;
  expect(profiles).toBe(0); expect(issue.status).toBe(200);
  await expect(page.getByText('予想との違いを見てみましょう')).toBeVisible();
  await nextQuestion(page);
  const wrong = await run(page, 'RefreshでProfileを取得する', 'profile');
  expect(wrong.code).toBe('malformed'); expect(wrong.http.requestHeaders.Authorization).toBe(`Bearer ${a.refreshToken}`);
  await nextQuestion(page);
  const expired = await run(page, '同じAccessを期限後に送る', 'profile');
  expect(expired.code).toBe('expired'); expect(expired.http.requestHeaders.Authorization).toBe(`Bearer ${a.accessToken}`);
  await nextQuestion(page);
  const refreshed = await run(page, 'Refreshで更新する', 'refresh'), b = refreshed.pair;
  expect(refreshed.http.requestBody).toEqual({ refreshToken: a.refreshToken }); expect(profiles).toBe(2);
  expect(b.refreshToken).not.toBe(a.refreshToken); expect(b.accessToken).not.toBe(a.accessToken); expect(b.familyId).toBe(a.familyId);
  expect(b.refreshExpiresAt).toBe(a.refreshExpiresAt);
  await nextQuestion(page);
  expect((await run(page, '新しいAccessでProfileを取得する', 'profile')).status).toBe(200);
  await nextQuestion(page);
  const reused = await run(page, '古いRefreshを再送する', 'refresh');
  expect(reused.code).toBe('reused'); expect(reused.http.requestBody.refreshToken).toBe(a.refreshToken);
  await expect(page.getByTestId('tokens-family-state')).toHaveText('更新可能 → 停止済み');
  await nextQuestion(page);
  const blocked = await run(page, '最新Refreshで更新を試す', 'refresh');
  expect(blocked.code).toBe('revoked'); expect(blocked.http.requestBody.refreshToken).toBe(b.refreshToken);
  await nextQuestion(page);
  const still = await run(page, '保持中のAccessをもう一度送る', 'profile');
  expect(still.status).toBe(200); expect(still.http.requestHeaders.Authorization).toBe(`Bearer ${b.accessToken}`);
  await expect(page.locator('.tokens-outcome')).toContainText('Profileを取得できました');
  await expect(page.locator('.tokens-outcome')).not.toContainText('HTTP');
  const outcome = await page.locator('.tokens-outcome').boundingBox(), map = await page.locator('.tokens-map').boundingBox();
  expect(outcome!.y).toBeLessThan(map!.y);
  await page.screenshot({ path: 'test-results/tokens-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/tokens-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '詳しく', exact: true }).click();
  await expect(page.locator('.tokens-outcome')).toContainText('HTTP 200');
  await expect(page.locator('.tokens-expiries')).toContainText('JST');
  await page.getByRole('button', { name: '学んだことを振り返る' }).click();
  await expect(page.getByRole('heading', { name: '更新を止めることと、今止めること。' })).toBeVisible();
  expect((await context.cookies()).some(c => c.value === a.refreshToken || c.value === b.accessToken)).toBe(false);
  expect(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(v => /rt_|eyJ/.test(v)))).toBe(false);
  expect(errors).toEqual([]);
});

test('free experiments distinguish manual stop and DB expiry, and history never restores a token', async ({ page }) => {
  await page.goto('/tokens'); await page.getByRole('button', { name: '自由に実験する', exact: true }).click();
  const action = async (name: string, operation: string) => {
    const response = page.waitForResponse(r => r.url().endsWith(`/api/tokens/${operation}`));
    await page.getByRole('button', { name, exact: true }).click();
    const data = await (await response).json(); await expect(page.locator('.tokens-outcome')).toBeVisible(); return data;
  };
  const a = (await action('2種類を発行', 'issue')).pair;
  const b = (await action('最新Refreshで更新', 'refresh')).pair;
  await page.getByLabel('過去の操作').selectOption({ index: 1 });
  await expect(page.getByText('現在保持：第2世代', { exact: false })).toBeVisible();
  const stop = await action('この系列の更新を停止', 'revoke'); expect(stop.http.requestBody.refreshToken).toBe(b.refreshToken);
  expect((await action('最新Refreshで更新', 'refresh')).code).toBe('revoked');
  const p = await action('AccessでProfile', 'profile'); expect(p.status).toBe(200); expect(p.http.requestHeaders.Authorization).toBe(`Bearer ${b.accessToken}`);
  expect(b.accessToken).not.toBe(a.accessToken);
  const c = (await action('2種類を発行', 'issue')).pair;
  await action('DBの更新期限を過去にする', 'expire');
  expect((await action('最新Refreshで更新', 'refresh')).code).toBe('refresh_expired');
  expect((await action('AccessでProfile', 'profile')).status).toBe(200);
  await page.reload(); await page.getByRole('button', { name: '自由に実験する', exact: true }).click();
  await expect(page.getByRole('button', { name: '最新Refreshで更新', exact: true })).toBeDisabled();
  expect(c.refreshToken).toMatch(/^rt_/);
});

test('a lost response after committed rotation does not trigger automatic replay or pretend success', async ({ page }) => {
  await page.goto('/tokens'); await page.getByRole('button', { name: '自由に実験する', exact: true }).click();
  await page.getByRole('button', { name: '2種類を発行', exact: true }).click();
  await expect(page.locator('.tokens-outcome')).toContainText('2種類を発行');
  let refreshes = 0;
  await page.route('**/api/tokens/refresh', async route => {
    refreshes++;
    const response = await route.fetch(); expect(response.status()).toBe(200);
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'response lost after commit' }) });
  });
  await page.getByRole('button', { name: '最新Refreshで更新', exact: true }).click();
  await expect(page.locator('.tokens-lab').getByRole('alert')).toContainText('自動再送しません');
  await expect(page.locator('.tokens-outcome')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '最新Refreshで更新', exact: true })).toBeDisabled();
  const state = await page.request.get('/api/tokens/state', { headers: { 'X-Lab-Request': '1' } });
  const db = await state.json(); expect(db.tokens).toHaveLength(2); expect(db.tokens[0].used_at).toBeTruthy();
  expect(db.families[0].revoked_at).toBeNull(); expect(refreshes).toBe(1);
  await page.getByRole('button', { name: '2種類を発行', exact: true }).click();
  await expect(page.locator('.tokens-outcome')).toContainText('2種類を発行');
  await expect(page.getByRole('button', { name: '最新Refreshで更新', exact: true })).toBeEnabled();
  expect(refreshes).toBe(1);
});
