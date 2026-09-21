import { test, expect, type Page } from '@playwright/test';

async function readResult(page: Page) {
  const next = page.getByRole('button', { name: '次へ', exact: true });
  await expect(next).toBeVisible();
  for (let i = 0; i < 12 && await next.isVisible(); i++) await next.click();
}
async function chooseAndRun(page: Page, button: string, choice = 'まだわからない') {
  await page.getByRole('radio', { name: choice, exact: true }).check();
  await page.getByRole('button', { name: button, exact: true }).click();
  await readResult(page);
}

test('JWT basic guide separates issuance, decoding and access, preserves Session and supports mobile', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/jwt');
  await expect(page.getByRole('button', { name: 'JWTの基本を始める' })).toBeEnabled();
  await page.evaluate(async () => {
    const headers = { 'X-Lab-Request': '1', 'Content-Type': 'application/json' };
    const response = await fetch('/api/login', { method: 'POST', headers, body: JSON.stringify({ email: 'sample@example.com', password: 'LearnSession!2026', ttl: 300 }) });
    if (!response.ok) throw new Error('Session setup failed');
  });
  const sid = (await context.cookies()).find(c => c.name === 'lab_session')!.value;
  let profileCalls = 0; page.on('request', r => { if (r.url().endsWith('/api/jwt/profile')) profileCalls++; });
  await page.getByRole('button', { name: 'JWTの基本を始める' }).click();
  await expect(page.getByRole('button', { name: 'JWTを発行して確かめる' })).toBeDisabled();
  await chooseAndRun(page, 'JWTを発行して確かめる', 'ブラウザにJWT、DBにJWTごとの対応表が残る');
  await expect(page.getByText('予想との違いを見てみましょう')).toBeVisible();
  expect(profileCalls).toBe(0);
  await page.getByRole('button', { name: '次の問いへ' }).click();
  await chooseAndRun(page, 'JWTの中身を読む');
  await expect(page.getByText('デコードした値・未検証：読めただけでは本物と判断できません。')).toBeVisible();
  expect(profileCalls).toBe(0);
  await page.screenshot({ path: 'test-results/jwt-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/jwt-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '次の問いへ' }).click();
  await chooseAndRun(page, 'JWTで自分の情報を見る');
  expect(profileCalls).toBe(1);
  await expect(page.locator('.jwt-verdict')).toHaveText('HTTP 200 · valid');
  await expect(page.getByText('Session 1件', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '学んだことを振り返る' }).click();
  await expect(page.getByRole('heading', { name: '読めることと、信用できることは別。' })).toBeVisible();
  expect((await context.cookies()).find(c => c.name === 'lab_session')!.value).toBe(sid);
  expect(await page.evaluate(() => Object.keys(localStorage).some(k => /jwt|token/i.test(k)))).toBe(false);
  expect(errors).toEqual([]);
});

test('JWT failure guide proves signature mismatch, natural expiry with the same token, and alg rejection', async ({ page }) => {
  await page.goto('/jwt');
  await page.getByRole('button', { name: '失敗する実験から始める' }).click();
  await chooseAndRun(page, '実験用JWTを発行する');
  await page.getByRole('button', { name: '次の問いへ' }).click();
  await chooseAndRun(page, 'Payloadを書き換えて送る');
  await expect(page.locator('.jwt-verdict')).toContainText('signature');
  await page.getByRole('button', { name: '次の問いへ' }).click();
  const issued = page.waitForResponse(r => r.url().endsWith('/api/jwt/issue'));
  await chooseAndRun(page, '15秒のJWTを発行する');
  const short = (await (await issued).json()).token;
  await page.getByRole('button', { name: '次の問いへ' }).click();
  await page.getByRole('radio', { name: 'まだわからない', exact: true }).check();
  const expire = page.getByRole('button', { name: '同じJWTを期限後に送る' });
  await expect(expire).toBeDisabled();
  await expect(expire).toBeEnabled({ timeout: 18000 });
  const response = page.waitForResponse(r => r.url().endsWith('/api/jwt/profile'));
  await expire.click(); await readResult(page);
  const result = await (await response).json();
  expect(result.code).toBe('expired');
  expect(result.http.requestHeaders.Authorization).toBe(`Bearer ${short}`);
  await page.getByRole('button', { name: '次の問いへ' }).click();
  await chooseAndRun(page, 'alg: noneのJWTを送る');
  await expect(page.locator('.jwt-verdict')).toContainText('algorithm');
  await page.getByRole('button', { name: '学んだことを振り返る' }).click();
  await expect(page.getByRole('heading', { name: '署名・期限・許可する方式。それぞれを確かめる。' })).toBeVisible();
});

test('JWT missing observations are not rewarded and can be retried; free mode does not persist tokens', async ({ page }) => {
  await page.goto('/jwt');
  await page.getByRole('button', { name: 'JWTの基本を始める' }).click();
  await page.getByRole('radio', { name: 'まだわからない', exact: true }).check();
  await page.route('**/api/jwt/issue', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '観測失敗テスト' }) }), { times: 1 });
  await page.getByRole('button', { name: 'JWTを発行して確かめる' }).click();
  await expect(page.locator('.jwt-lab').getByRole('alert')).toContainText('観測失敗テスト');
  await expect(page.getByRole('button', { name: '次の問いへ' })).toHaveCount(0);
  await page.getByRole('button', { name: 'JWTを発行して確かめる' }).click(); await readResult(page);
  await page.getByRole('button', { name: '自由に実験する', exact: true }).click();
  await page.getByRole('button', { name: 'roleを変えて送信', exact: true }).click();
  await expect(page.getByRole('option', { name: /tamper.*signature/ })).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: '自由に実験する', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Profileを取得', exact: true })).toBeDisabled();
});
