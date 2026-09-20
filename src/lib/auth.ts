import { randomBytes, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { Trace } from "./trace";
import {
  snapshot,
  findUser,
  findSession,
  isSessionValid,
  issueSession,
  deleteSession,
  expireSession,
  resetSpace,
} from "./store";
import { verifyPassword, validCredentials, hashPassword } from "./password";
import { cookieView, cookieString, SESSION_COOKIE } from "./http";
import type { LabState, Result, Snapshot } from "./types";

let dummyHash: Promise<string> | undefined;
export async function getState(
  req: NextRequest,
  lab: string,
  cookieOverride?: { value: string; expires: string } | null,
): Promise<LabState> {
  const snap = await snapshot(lab);
  const id =
    cookieOverride === null
      ? undefined
      : (cookieOverride?.value ?? req.cookies.get(SESSION_COOKIE)?.value);
  const session = snap.sessions.find((s) => s.id === id);
  const user = snap.users.find((u) => u.id === session?.user_id);
  const valid = isSessionValid(session) && user?.status === "active";
  const { password_hash: _, ...safeUser } = user ?? { password_hash: "" };
  return {
    snapshot: snap,
    authenticated: !!valid,
    user: valid ? (safeUser as NonNullable<LabState["user"]>) : null,
    cookie: id
      ? cookieView(
          req,
          id,
          cookieOverride?.expires ?? null,
          cookieOverride
            ? "Set-Cookie発行記録（保存は次のリクエストで確認）"
            : "今回のHTTPリクエストでサーバーが受信。Cookie属性はサーバー設定。ExpiresはCookieリクエストに含まれません。",
        )
      : null,
    sessionStatus: !id
      ? "Cookieなし"
      : !session
        ? "Sessionレコードなし"
        : !isSessionValid(session)
          ? "期限切れ"
          : !valid
            ? "ユーザー無効"
            : "有効",
    sessionExpires: session?.expires_at ?? null,
    serverTime: new Date().toISOString(),
    transport:
      new URL(process.env.APP_ORIGIN ?? req.url).protocol === "https:"
        ? "HTTPS"
        : "HTTP（ローカル学習環境）",
  };
}
export type Action =
  "login" | "password" | "profile" | "admin" | "logout" | "expire" | "reset";
export async function execute(
  req: NextRequest,
  lab: string,
  action: Action,
  body?: unknown,
): Promise<{
  result: Result;
  setSession?: { value: string; expires: string };
  clearSession?: boolean;
}> {
  const protocol =
    new URL(process.env.APP_ORIGIN ?? req.url).protocol === "https:"
      ? "HTTPS"
      : "HTTP";
  const t = new Trace(protocol);
  const requestId = randomUUID();
  const oldId = req.cookies.get(SESSION_COOKIE)?.value;
  const before = await snapshot(lab);
  let status = 200,
    message = "",
    success = true,
    issued: { value: string; expires: string } | undefined,
    clear = false;
  let responseBody: Record<string, unknown> = {};
  let requestBody: unknown;
  const method = req.method,
    path = new URL(req.url).pathname;
  const snapStep = (
    what: string,
    why: string,
    data: Record<string, unknown>,
    s: Snapshot,
    changed?: "sessions",
  ) =>
    t.add(
      "Database",
      "Authentication Server",
      "Database",
      what,
      why,
      "すべてのSQLはlab_idでスコープし、パラメーター化して実行する。",
      data,
      "Authentication Server",
      "PostgreSQL",
      s,
      changed,
    );
  if (action === "login" || action === "password") {
    if (!validCredentials(body)) {
      status = 400;
      success = false;
      message =
        "EmailとPasswordを確認してください。Passwordは1〜72 UTF-8バイト、期限は15または300秒です。";
    } else {
      const { email, password } = body;
      requestBody = {
        email,
        password: "[REDACTED]",
        ...(action === "login" ? { ttl: body.ttl ?? 300 } : {}),
      };
      t.add(
        "User",
        "User",
        "Client Application",
        "資格情報を入力",
        "本人確認に使う情報を渡します。",
        "emailは識別子、passwordはCredential。平文は入力と照合に必要な一時メモリーにのみ存在する。",
        { email, password: "[REDACTED]" },
        "User",
        "入力フォームのみ",
        before,
        undefined,
        "browser-model",
      );
      t.add(
        "Browser",
        "Browser",
        "Authentication Server",
        `${method} ${path}`,
        "サーバーに本人確認を依頼します。",
        `${protocol === "HTTP" ? "このlocalhost環境はHTTP。実運用ではTLS/HTTPS必須。" : "HTTPSで転送。"} パスワードはブラウザーでハッシュ化して置き換えずサーバーへ送り、サーバーで検証する。`,
        requestBody as Record<string, unknown>,
        "Browser",
        "サーバーの一時メモリー",
        before,
      );
      const user = await findUser(lab, email.trim().toLowerCase());
      snapStep(
        "usersからユーザーを検索",
        "Emailに対応する保存済みハッシュを取得します。",
        {
          email,
          found: !!user,
          user_id: user?.id ?? null,
          password_hash: user?.password_hash ?? null,
        },
        before,
      );
      const hash =
        user?.password_hash ??
        (await (dummyHash ??= hashPassword(randomBytes(32).toString("hex"))));
      const verified = await verifyPassword(password, hash);
      t.add(
        "Authentication Server",
        "Database",
        "Authentication Server",
        "Password Hashを検証",
        "入力が登録時のパスワードと一致するか確かめます。",
        "bcrypt.compareは保存ハッシュ中のSaltとCostを使って検証する。ランダムSaltで再hashして文字列比較するのではない。",
        {
          algorithm: "bcrypt",
          cost: 12,
          matched: !!user && verified,
          password: "[REDACTED]",
        },
        "bcrypt（登録時にSalt生成）",
        "users.password_hash",
        before,
      );
      if (!user || !verified || user.status !== "active") {
        status = 401;
        success = false;
        message = "EmailまたはPasswordが正しくありません。";
        t.add(
          "Authentication Server",
          "Authentication Server",
          "Browser",
          "本人確認に失敗",
          "Sessionは新規発行しません。",
          "ユーザーの存在や無効化状態はエラーメッセージで区別しない。既存Sessionがある場合は維持する。",
          { status: 401 },
          "Authentication Server",
          "なし",
          before,
        );
      } else {
        message =
          action === "password"
            ? "パスワード照合成功。Sessionは発行していません。"
            : "ログイン成功。Sessionを発行しました。";
        t.add(
          "Authentication Server",
          "Authentication Server",
          "Authentication Server",
          "本人確認に成功",
          "このリクエストの利用者が誰か分かりました。",
          "認証(Authentication)成功。継続的なログイン状態を作る処理は別に必要。",
          { user_id: user.id, role: user.role },
          "Authentication Server",
          "リクエスト内メモリー",
          before,
        );
        if (action === "login") {
          const id = randomBytes(32).toString("hex");
          t.add(
            "Authentication Server",
            "Authentication Server",
            "Authentication Server",
            "Session IDを生成",
            "推測できない受付番号を作ります。",
            "node:crypto.randomBytes(32)。256bit乱数を64文字のhexで表現。IDにEmailやroleを埋め込まない。",
            { session_id: id },
            "Authentication Server",
            "一時メモリー",
            before,
          );
          const session = await issueSession(
            lab,
            user,
            oldId,
            body.ttl ?? 300,
            id,
          );
          const after = await snapshot(lab);
          issued = { value: id, expires: session.expires_at };
          snapStep(
            "Session Storeに保存",
            "受付番号とユーザーの対応をサーバーが覚えます。",
            {
              session_id: id,
              user_id: user.id,
              expires_at: session.expires_at,
              rotated: !!oldId,
            },
            after,
            "sessions",
          );
          t.add(
            "Authentication Server",
            "Authentication Server",
            "Browser",
            "Set-Cookieを返却",
            "次回も同じ受付番号を送ってもらいます。",
            "ログインごとにIDを再発行し、旧IDを同一トランザクションで削除する。Session Fixation対策。",
            { "Set-Cookie": cookieString(id, session.expires_at) },
            "Authentication Server",
            "BrowserのCookieストア",
            after,
          );
          t.add(
            "Browser",
            "Browser",
            "Browser",
            "Cookieの保存をブラウザーへ指示",
            "以降の同一サイトへのリクエストで自動送信されます。",
            "ここはSet-Cookieに基づくブラウザー動作の説明。HttpOnlyはJavaScriptから読めない。保存されたかは次のAPIでCookie受信を確認する。",
            { name: SESSION_COOKIE, value: id, httpOnly: true },
            "Authentication Server",
            "BrowserのCookieストア",
            after,
            undefined,
            "browser-model",
          );
        }
        responseBody = {
          success: true,
          user: { id: user.id, email: user.email, role: user.role },
          sessionCreated: action === "login",
        };
      }
    }
  } else if (action === "profile" || action === "admin") {
    t.add(
      "Client Application",
      "Client Application",
      "Browser",
      `${path}を呼び出す`,
      "保護された情報を取得します。",
      "fetch(credentials: same-origin)を実行。JSでHttpOnly Cookieを読む必要はない。",
      { method, path },
      "Client Application",
      "Browser",
      before,
      undefined,
      "browser-model",
    );
    t.add(
      "Browser",
      "Browser",
      "Resource API",
      "CookieをAPIへ送信",
      "サーバーに受付番号を提示します。",
      "このCookie値はサーバーが今回のHTTPリクエストで実際に受信した値。",
      { Cookie: oldId ? `${SESSION_COOKIE}=${oldId}` : "（なし）" },
      "Browser",
      "Resource APIのリクエスト",
      before,
    );
    const session = oldId ? await findSession(lab, oldId) : undefined;
    t.add(
      "Database",
      "Resource API",
      "Database",
      "Session Storeを照合",
      "番号に対応するユーザーと有効期限を調べます。",
      "lab_idとSession IDをキーにSELECT。Cookieが存在するだけでは認証成功にならない。",
      {
        session_id: oldId ?? null,
        found: !!session,
        expires_at: session?.expires_at ?? null,
      },
      "Authentication Server",
      "PostgreSQL",
      before,
    );
    const state = await getState(req, lab);
    if (!state.authenticated) {
      status = 401;
      success = false;
      message = `認証が必要です：${state.sessionStatus}。`;
      t.add(
        "Resource API",
        "Database",
        "Resource API",
        "401：ログイン状態を確認できない",
        "再ログインが必要です。",
        "サーバー時刻でexpires_atを検証し、ユーザーのstatusも確認。CookieのExpiresだけに依存しない。",
        { status, reason: state.sessionStatus },
        "Resource API",
        "なし",
        before,
      );
    } else {
      t.add(
        "Resource API",
        "Database",
        "Resource API",
        "SessionからUserを特定",
        "同じ利用者だと確認できました。",
        "各APIでSession・期限・ユーザー状態を再検証する。ログイン時に一度チェックして終わりではない。",
        {
          user_id: state.user?.id,
          email: state.user?.email,
          role: state.user?.role,
        },
        "Resource API",
        "リクエスト内メモリー",
        before,
      );
      if (action === "admin" && state.user?.role !== "admin") {
        status = 403;
        success = false;
        message = "403：本人確認は成功していますが、admin権限がありません。";
      } else {
        message =
          action === "admin"
            ? "200：admin権限を確認しました。"
            : "200：ログイン中のユーザー情報を取得しました。";
        responseBody = { user: state.user };
      }
      if (action === "admin")
        t.add(
          "Resource API",
          "Resource API",
          "Browser",
          `${status}：roleを確認`,
          "認証と認可は別の判断です。",
          "401は有効な認証情報なし、403は認証済みでもこのAPIのrole要件を満たさない。",
          { required: "admin", actual: state.user?.role, status },
          "users.role",
          "PostgreSQL",
          before,
        );
    }
  } else {
    requestBody = {};
    t.add(
      "Browser",
      "Browser",
      "Authentication Server",
      `${method} ${path}`,
      "ログイン状態を変更します。",
      "Origin完全一致、JSON Content-Type、カスタムヘッダーで同一Originの教育操作に限定。",
      { action, session_id: oldId ?? null },
      "Browser",
      "Authentication Server",
      before,
    );
    if (action === "logout") {
      if (oldId) await deleteSession(lab, oldId);
      clear = true;
      message = "ログアウトしました。SessionレコードとCookieを削除しました。";
    }
    if (action === "expire") {
      if (oldId) await expireSession(lab, oldId);
      message =
        "実験：DBの有効期限を過去に変更しました。Cookieは残ります。Profileを呼び出してください。";
    }
    if (action === "reset") {
      await resetSpace(lab);
      clear = true;
      message =
        "この学習空間のSessionを初期化しました。デモユーザーは保持されます。";
    }
    const after = await snapshot(lab);
    snapStep(
      action === "expire" ? "expires_atを過去へ変更" : "Sessionレコードを削除",
      action === "expire"
        ? "サーバーの期限判定を実験します。"
        : "古いIDを使えなくします。",
      { action, session_id: oldId ?? null },
      after,
      "sessions",
    );
    t.add(
      "Authentication Server",
      "Authentication Server",
      "Browser",
      clear ? "Cookieを削除するレスポンス" : "Cookieを残して応答",
      clear
        ? "ブラウザー側もログイン状態を手放します。"
        : "CookieとSessionの有効性は別物です。",
      clear
        ? "Max-Age=0とExpiresを過去に設定。同じPath/Domainで削除。DB側の削除も必要。"
        : "これは教育用のDB更新。通常の自然失効はサーバー時刻で判定する。",
      { cookie: clear ? "Max-Age=0" : "変更なし" },
      "Authentication Server",
      "Browser",
      after,
    );
  }
  if (!success) responseBody = { error: message };
  else responseBody = { ...responseBody, success: true, message };
  const state = await getState(req, lab, clear ? null : issued);
  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, private",
    "X-Request-ID": requestId,
  };
  if (issued)
    responseHeaders["Set-Cookie"] = cookieString(issued.value, issued.expires);
  if (clear)
    responseHeaders["Set-Cookie"] =
      `${SESSION_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`;
  const requestHeaders: Record<string, string> = { "X-Lab-Request": "1" };
  if (req.method === "POST") {
    requestHeaders["Content-Type"] = "application/json";
    requestHeaders.Origin = req.headers.get("origin") ?? "";
  }
  requestHeaders.Cookie = oldId
    ? `${SESSION_COOKIE}=${oldId}; lab_space=[REDACTED]`
    : "lab_space=[REDACTED]";
  return {
    result: {
      success,
      message,
      trace: t.steps,
      http: {
        method,
        path,
        requestHeaders,
        requestBody,
        status,
        responseHeaders,
        responseBody,
      },
      state,
      requestId,
    },
    setSession: issued,
    clearSession: clear,
  };
}
