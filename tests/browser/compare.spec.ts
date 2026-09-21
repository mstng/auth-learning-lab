import { test, expect, type Page } from '@playwright/test';

async function readResult(page: Page) {
  const next = page.getByRole('button', { name: '次へ', exact: true });
  await expect(next).toBeVisible();
  for (let i = 0; i < 10 && await next.isVisible(); i++) await next.click();
}
async function run(page: Page, button: string, choice = 'まだわからない') {
  await page.getByRole('radio', { name: choice, exact: true }).check();
  await page.getByRole('button', { name: button, exact: true }).click();
  await readResult(page);
}
async function beforeLogout(page: Page) {
  await page.goto('/compare');
  await page.getByRole('button', { name: '比較ガイドを始める' }).click();
  await run(page, '両方を発行して確かめる');
  await page.getByRole('button', { name: '次の問いへ' }).click();
  await run(page, '両方でProfileを取得する');
  await page.getByRole('button', { name: '次の問いへ' }).click();
}

test('comparison guide proves logout replay with the same credentials and separates architecture models', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let profiles = 0, apiCalls = 0;
  page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) apiCalls++; if (/\/api\/(jwt\/)?profile$/.test(r.url())) profiles++; });
  await page.goto('/compare');
  await page.getByRole('button', { name: '比較ガイドを始める' }).click();
  await expect(page.getByRole('button', { name: '両方を発行して確かめる' })).toBeDisabled();
  const issue = page.waitForResponse(r => r.url().endsWith('/api/jwt/issue'));
  await run(page, '両方を発行して確かめる', 'どちらも、トークンごとの有効状態をDBに記録する');
  const token = (await (await issue).json()).token;
  const sid = (await context.cookies()).find(c => c.name === 'lab_session')!.value;
  expect(profiles).toBe(0);
  await expect(page.getByText('予想との違いを見てみましょう')).toBeVisible();
  await expect(page.getByTestId('compare-session-count')).toHaveText('0 → 1件');
  await page.getByRole('button', { name: '次の問いへ' }).click();
  await run(page, '両方でProfileを取得する');
  expect(profiles).toBe(2);
  await page.getByRole('button', { name: '次の問いへ' }).click();
  await run(page, '両方をログアウトする');
  await expect(page.getByTestId('compare-session-count')).toHaveText('1 → 0件');
  expect((await context.cookies()).some(c => c.name === 'lab_session')).toBe(false);
  await page.getByRole('button', { name: '次の問いへ' }).click();
  const replay = page.waitForResponse(r => r.url().endsWith('/api/compare/session-replay'));
  const jwt = page.waitForResponse(r => r.url().endsWith('/api/jwt/profile'));
  await run(page, '同じコピーを再送する');
  const sr = await (await replay).json(), jr = await (await jwt).json();
  expect(sr.status).toBe(401); expect(sr.code).toBe('missing'); expect(sr.sessionId).toBe(sid);
  expect(sr.http.requestBody.sessionId).toBe(sid);
  expect(jr.status).toBe(200); expect(jr.http.requestHeaders.Authorization).toBe(`Bearer ${token}`);
  await expect(page.locator('.compare-verdict')).toHaveText('Session HTTP 401（missing） ／ JWT HTTP 200（valid）');
  await page.screenshot({ path: 'test-results/compare-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/compare-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const beforeModels = apiCalls;
  await page.getByRole('button', { name: '次の問いへ' }).click();
  await page.getByRole('radio', { name: 'まだわからない', exact: true }).check();
  await page.getByRole('button', { name: '失効の設計を比べる' }).click();
  await expect(page.getByText('説明モデル · 実API・DBは変わりません')).toBeVisible();
  await page.getByRole('button', { name: '失効リストあり', exact: true }).click();
  await expect(page.locator('.compare-model-answer')).toContainText('保存・照会・更新');
  await page.getByRole('button', { name: '次の問いへ' }).click();
  await page.getByRole('radio', { name: 'まだわからない', exact: true }).check();
  await page.getByRole('button', { name: '2台の構成を比べる' }).click();
  await page.getByRole('button', { name: 'JWT＋失効リスト', exact: true }).click();
  await expect(page.locator('.compare-model-answer')).toContainText('反映が遅れる');
  await page.screenshot({ path: 'test-results/compare-model-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(apiCalls).toBe(beforeModels);
  await page.getByRole('button', { name: '学んだことを振り返る' }).click();
  await expect(page.getByRole('heading', { name: '失効を、どこで判断するか。' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('comparison retries only observation after a completed logout and does not invent completion', async ({ page }) => {
  await beforeLogout(page);
  let observations = 0, logouts = 0;
  page.on('request', r => { if (r.url().endsWith('/api/logout')) logouts++; });
  await page.route('**/api/lab/state', route => {
    observations++;
    return observations === 2 ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '操作後の観測失敗テスト' }) }) : route.continue();
  });
  await page.getByRole('radio', { name: 'まだわからない', exact: true }).check();
  await page.getByRole('button', { name: '両方をログアウトする' }).click();
  await expect(page.locator('.compare-lab').getByRole('alert')).toContainText('再試行では観測だけ');
  await expect(page.getByRole('button', { name: '次の問いへ' })).toHaveCount(0);
  expect(logouts).toBe(1);
  await page.getByRole('button', { name: '観測を再試行する' }).click(); await readResult(page);
  expect(logouts).toBe(1); expect(observations).toBe(3);
  await expect(page.getByTestId('compare-session-count')).toHaveText('1 → 0件');
  await page.getByRole('button', { name: '次の問いへ' }).click();
  await run(page, '同じコピーを再送する');
  await expect(page.locator('.compare-verdict')).toContainText('JWT HTTP 200');
});

test('comparison free replay and history keep live state separate, with no persisted copies', async ({ page, context }) => {
  await page.goto('/compare');
  await page.getByRole('button', { name: '自由に実験する', exact: true }).click();
  await page.getByRole('button', { name: '両方を発行', exact: true }).click();
  await expect(page.getByRole('option', { name: /1\..*発行/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'コピーを再送', exact: true }).click();
  await expect(page.locator('.compare-verdict')).toContainText('Session HTTP 200');
  await page.getByRole('button', { name: '両方をログアウト', exact: true }).click();
  await expect(page.locator('.compare-verdict')).toContainText('保持を解除');
  await page.getByRole('button', { name: 'コピーを再送', exact: true }).click();
  await expect(page.locator('.compare-verdict')).toContainText('Session HTTP 401');
  await page.getByLabel('過去の操作').selectOption({ index: 1 });
  await expect(page.getByRole('button', { name: '両方でアクセス', exact: true })).toBeDisabled();
  expect((await context.cookies()).some(c => c.name === 'lab_session')).toBe(false);
  expect(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(v => /eyJ|lab_session/.test(v)))).toBe(false);
  await page.reload();
  await page.getByRole('button', { name: '自由に実験する', exact: true }).click();
  await expect(page.getByRole('button', { name: 'コピーを再送', exact: true })).toBeDisabled();
});
