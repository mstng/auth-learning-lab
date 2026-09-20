import { test, expect } from "@playwright/test";
test.beforeEach(async ({page}) => {
  page.on('response', async response => {
    if (response.url().includes('/api/lab/init') && response.status() !== 200) console.log('Init failed:', response.status(), await response.text());
  });
});
test("session flow, data inspectors, logout and responsive layout", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/session");
  const login = page.getByRole("button", {
    name: "ログインする",
    exact: true,
  });
  await expect(login).toBeEnabled({timeout:15000});
  await page.locator(".reference-guide > summary").click();
  await expect(page.getByRole("region", { name: "システムのつながり" })).toBeVisible();
  await page.getByRole("button", { name: "② ログイン後のアクセス" }).click();
  await expect(page.locator(".story-content")).toContainText("パスワードの再入力は不要");
  await page.getByRole("button", { name: "③ ログアウト", exact: true }).click();
  await expect(page.locator(".story-content")).toContainText("両方を削除");
  await page.getByRole("button", { name: "④ 期限切れ", exact: true }).click();
  await expect(page.locator(".story-content")).toContainText("期限が過ぎたら使えない");
  await expect(page.locator(".auth-state")).toContainText("未ログイン");
  await page.getByRole("button", { name: "① 最初のログイン" }).click();
  await login.click();
  await expect(page.locator(".auth-state")).toContainText("ログイン中");
  await expect(page.locator(".step-index")).toContainText("/ 09");
  await expect(page.locator(".plain-explanation")).toContainText("何が起きた？");
  await expect(page.locator(".step-technical")).not.toHaveAttribute("open", "");
  await page.getByRole("button", { name: "詳しく", exact: true }).click();
  await expect(page.locator(".step-technical")).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "やさしく", exact: true }).click();
  const cookie = (await context.cookies()).find(
    (c) => c.name === "lab_session",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect(cookie?.secure).toBe(false);
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "lab_session",
  );
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page.locator(".current-step")).toContainText("Browser");
  await page.getByRole("tab", { name: /DBの中身/ }).click();
  await page.getByRole("button", { name: "sessions 0", exact: true }).click();
  await expect(page.locator(".empty-table")).toContainText(
    "Sessionレコードはありません",
  );
  await page.getByRole("slider", { name: "再生ステップ" }).fill("6");
  await expect(page.locator(".changed-row")).toHaveCount(1);
  await page.getByRole("button", { name: "自分の情報を見る Profile API · GET /api/profile" }).click();
  await expect(page.locator(".step-index")).toContainText("/ 13");
  await page.getByRole("tab", { name: /処理の記録/ }).click();
  await page.locator(".trace-log button").last().click();
  await expect(page.locator(".current-step")).toContainText("Resource API");
  await page.getByRole("tab", { name: /値の実物/ }).click();
  await expect(page.locator(".raw-grid")).toContainText(cookie!.value);
  await page.getByRole("tab", { name: /ブラウザの保存内容/ }).click();
  await expect(page.locator(".browser-grid")).toContainText("httpOnly");
  await page.getByRole('tab',{name:/順番の図/}).click();
  await expect(page.locator('.sequence-grid svg')).toHaveCount(2);
  await page.getByRole('button',{name:'STEP 6',exact:true}).click();
  await expect(page.locator('.current-step')).toContainText('Session IDを生成');
  await page.getByRole("button", { name: "管理者だけの操作 Admin API · GET /api/admin" }).click();
  await expect(page.locator(".result-message")).toContainText("403");
  await page
    .getByRole("button", { name: "DBの期限を切らす Cookieを残して失効させる" })
    .click();
  await page
    .getByRole("button", { name: "自分の情報を見る Profile API · GET /api/profile" })
    .click();
  await expect(page.locator(".result-message")).toContainText("期限切れ");
  await login.click();
  await expect(page.locator(".auth-state")).toContainText("ログイン中");
  await page.reload();
  await expect(page.locator(".auth-state")).toContainText("ログイン中");
  await page
    .getByRole("button", { name: "ログアウト SessionとCookieを削除" })
    .click();
  await expect(page.locator(".auth-state")).toContainText("未ログイン");
  expect((await context.cookies()).some((c) => c.name === "lab_session")).toBe(
    false,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1600, height: 1050 });
  await page.getByRole("button", { name: "実験を初期化", exact: true }).click();
  await expect(page.locator(".step-index")).toContainText("/ 00");
  await login.click();
  await expect(page.locator('.auth-state')).toContainText('ログイン中');
  await page.getByRole("slider", { name: "再生ステップ" }).fill("6");
  await page.getByRole("tab", { name: /DBの中身/ }).click();
  await page.getByRole("button", { name: "sessions 1", exact: true }).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:'test-results/session-preview.png',fullPage:false});
  await page.screenshot({
    path: "test-results/session-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test('short-lived session naturally expires in the browser and on the server',async({page,context})=>{
  await page.goto('/session');
  await page.getByLabel('Sessionの有効期限').selectOption('15');
  await page.getByRole('button',{name:'ログインする',exact:true}).click();
  await expect(page.locator('.auth-state')).toContainText('ログイン中');
  await expect.poll(async()=> (await context.cookies()).some(c=>c.name==='lab_session'),{timeout:20000,intervals:[1000]}).toBe(false);
  await page.getByRole('button',{name:'自分の情報を見る Profile API · GET /api/profile'}).click();
  await expect(page.locator('.auth-state')).toContainText('未ログイン');
  await expect(page.locator('.result-message')).toContainText('認証が必要');
});
test("password-only auth, salt inspection, roadmap persistence and navigation", async ({
  page,
}) => {
  await page.goto("/password");
  await page
    .getByRole("button", { name: "パスワードを照合", exact: true })
    .click();
  await expect(page.locator(".result-message")).toContainText(
    "Sessionは発行していません",
  );
  await page
    .getByRole("button", { name: "自分の情報を見る Profile API · GET /api/profile" })
    .click();
  await expect(page.locator(".result-message")).toContainText("認証が必要");
  await page.getByRole("tab", { name: /値の実物/ }).click();
  await expect(page.locator(".raw-grid")).toContainText("Salt（encoded）");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Identity / Credentialを学習済みにする" })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Identity / Credentialを学習済みにする" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  await page
    .getByRole("link", { name: "Database Viewer", exact: true })
    .click();
  await expect(page.locator("table tbody tr")).toHaveCount(2);
});


test("guided tour separates requests, links diagram and differences, and proves logout", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const profileRequests: { method: string; body: string | null }[] = [];
  page.on("request", r => { if (new URL(r.url()).pathname === "/api/profile") profileRequests.push({ method: r.method(), body: r.postData() }); });
  await page.goto("/session");
  await page.getByRole("button", { name: "5分ガイドを始める", exact: true }).click();
  await expect(page.locator(".tour-count")).toHaveText("0 / 4 確認できた");
  await page.getByRole("button", { name: "① ログインする", exact: true }).click();
  await expect(page.locator(".tour-count")).toHaveText("1 / 4 確認できた");
  expect(profileRequests).toEqual([]);
  const cookie = (await context.cookies()).find(c => c.name === "lab_session")!;
  await expect(page.locator(".change-summary")).toContainText("Cookie：番号を保存");
  await expect(page.getByRole("region", { name: "変更前", exact: true })).toContainText("記録なし");
  await expect(page.getByRole("region", { name: "変更後", exact: true })).toContainText(cookie.value.slice(0, 10));
  await page.getByRole("slider", { name: "再生ステップ" }).fill("1");
  await expect(page.locator('.execution-bridge [data-active="true"]')).toHaveCount(1);
  await expect(page.locator('.execution-bridge [data-active="true"]')).toContainText("依頼・Cookieを送る");
  await page.getByRole("slider", { name: "再生ステップ" }).fill("6");
  await expect(page.locator('.execution-place[data-current="true"]')).toHaveAttribute("data-place", "database");
  await expect(page.locator(".step-db-diff")).toContainText("1件追加");
  await page.getByRole("button", { name: "② 自分の情報を見る", exact: true }).click();
  await expect(page.locator(".tour-count")).toHaveText("2 / 4 確認できた");
  expect(profileRequests).toEqual([{ method: "GET", body: null }]);
  await expect(page.locator(".change-summary")).toContainText("Cookie：変更なし");
  await expect(page.locator(".challenge").nth(0)).toHaveAttribute("data-achieved", "true");
  await page.getByRole("button", { name: "③ ログアウトする", exact: true }).click();
  await expect(page.locator(".tour-count")).toHaveText("3 / 4 確認できた");
  await expect(page.locator(".change-summary")).toContainText("Cookie：番号を削除");
  await expect(page.locator(".change-summary")).toContainText("1件削除");
  await page.getByRole("button", { name: "④ もう一度、自分の情報を見る", exact: true }).click();
  await expect(page.locator(".tour-count")).toHaveText("4 / 4 確認できた");
  await expect(page.locator(".tour-prompt")).toContainText("4つの実験を確認できました");
  await expect(page.locator(".challenge").nth(4)).toHaveAttribute("data-achieved", "true");
  await page.locator(".tour-proofs").getByRole("button", { name: "記録を見る", exact: true }).first().click();
  await expect(page.locator(".changes-heading")).toContainText("操作 1 · ログイン");
  await expect(page.locator(".auth-state")).toContainText("未ログイン");
  await expect(page.locator(".change-summary")).toContainText("Cookie：番号を保存");
  await page.getByRole("slider", { name: "再生ステップ" }).fill("6");
  await page.setViewportSize({ width: 1600, height: 1050 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "test-results/guided-preview.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/guided-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "実験を初期化", exact: true }).click();
  await expect(page.locator('.challenge[data-achieved="true"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("achievements require the matching failure, not any 401", async ({ page }) => {
  await page.goto("/session");
  const profile = page.getByRole("button", { name: "自分の情報を見る Profile API · GET /api/profile" });
  await profile.click();
  await expect(page.locator(".result-message")).toContainText("認証が必要");
  await expect(page.locator('.challenge[data-achieved="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: /間違ったPasswordで試す/ }).click();
  await expect(page.locator(".challenge").nth(1)).toHaveAttribute("data-achieved", "true");
  await page.getByRole("button", { name: "ログインする", exact: true }).click();
  await expect(page.locator(".auth-state")).toContainText("ログイン中");
  await page.getByRole("button", { name: /管理者だけの操作/ }).click();
  await expect(page.locator(".challenge").nth(3)).toHaveAttribute("data-achieved", "true");
  await page.getByRole("button", { name: /DBの期限を切らす/ }).click();
  await expect(page.locator(".change-summary")).toContainText("1件更新");
  await profile.click();
  await expect(page.locator(".challenge").nth(2)).toHaveAttribute("data-achieved", "true");
  await expect(page.locator(".challenge").nth(4)).toHaveAttribute("data-achieved", "false");
});

test("unconfirmed Cookie observation never grants a guided achievement", async ({ page, context }) => {
  await page.goto("/session");
  await page.getByRole("button", { name: "5分ガイドを始める", exact: true }).click();
  await expect(page.locator(".tour-count")).toHaveText("0 / 4 確認できた");
  let observations = 0;
  await page.route("**/api/lab/state", async route => { observations++; if (observations === 2) await route.abort(); else await route.continue(); });
  await page.getByRole("button", { name: "① ログインする", exact: true }).click();
  await expect(page.locator(".changes-panel")).toContainText("比較と達成判定は保留");
  expect((await context.cookies()).some(c => c.name === "lab_session")).toBe(true);
  await expect(page.locator(".tour-count")).toHaveText("0 / 4 確認できた");
  await page.unroute("**/api/lab/state");
  await page.getByRole("button", { name: "① ログインする", exact: true }).click();
  await expect(page.locator(".tour-count")).toHaveText("1 / 4 確認できた");
});


test("input rejection remains reviewable without mixing in a previous operation", async ({ page }) => {
  await page.goto("/session");
  await page.getByRole("button", { name: "ログインする", exact: true }).click();
  await expect(page.locator(".auth-state")).toContainText("ログイン中");
  await page.getByLabel("Password", { exact: true }).fill("x".repeat(73));
  await page.getByRole("button", { name: "ログインする", exact: true }).click();
  await expect(page.locator(".current-step")).toContainText("入力の確認で終了");
  await expect(page.locator(".changes-heading")).toContainText("操作 2 · ログイン");
  await expect(page.locator(".change-summary")).toContainText("Cookie：変更なし");
  await page.getByLabel("見返す操作").selectOption("0");
  await expect(page.locator(".current-step")).toContainText("メールアドレスとパスワードを入力");
  await page.getByLabel("見返す操作").selectOption("1");
  await expect(page.locator(".current-step")).toContainText("入力の確認で終了");
  await expect(page.locator(".challenge").nth(1)).toHaveAttribute("data-achieved", "false");
});
