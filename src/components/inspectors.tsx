"use client";
import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import type { Snapshot, Step, Result, LabState } from "@/lib/types";
export function Code({ value }: { value: unknown }) {
  return (
    <pre>
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}
export function DatabaseView({
  snapshot,
  previous,
  changed,
}: {
  snapshot?: Snapshot;
  previous?: Snapshot;
  changed?: string;
}) {
  const [table, setTable] = useState<keyof Snapshot>("users");
  const [filter, setFilter] = useState("");
  const all = snapshot?.[table] ?? [];
  const rows = all.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()),
  );
  const columns =
    table === "users"
      ? ["id", "email", "password_hash", "role", "status", "created_at"]
      : table === "sessions"
        ? ["id", "user_id", "expires_at", "created_at"]
        : table === "refresh_tokens"
          ? ["id", "user_id", "family_id", "generation", "token_hash", "expires_at", "used_at", "revoked_at"]
          : table === "oauth_clients"
            ? ["client_id", "client_name", "redirect_uri"]
            : ["code", "client_id", "user_id", "expires_at"];
  const old = previous?.[table] ?? [];
  const removed = old.filter(
    (r) =>
      !all.some((n) => (n as { id?: string }).id === (r as { id?: string }).id),
  );
  return (
    <div>
      <div className="db-toolbar">
        <div className="chip-row">
          {(
            [
              "users",
              "sessions",
              "refresh_tokens",
              "oauth_clients",
              "authorization_codes",
            ] as const
          ).map((name) => (
            <button
              key={name}
              aria-label={`${name} ${snapshot?.[name].length ?? 0}`}
              className={`chip ${table === name ? "selected" : ""}`}
              onClick={() => setTable(name)}
            >
              {name}
              <span>{snapshot?.[name].length ?? 0}</span>
            </button>
          ))}
        </div>
        <input
          aria-label="DBレコードを絞り込む"
          placeholder="レコードを絞り込む…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {table === "refresh_tokens" && <p className="notice">PHASE 9の更新用の実記録です。平文のトークンは保存せず、ハッシュ・系列・世代・使用済み／停止日時を確認できます。</p>}
      {table !== "users" && table !== "sessions" && table !== "refresh_tokens" && (
        <p className="notice">
          予約スキーマのみ。トークン・OAuthはPHASE 7以降で実装します。
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const row = r as Record<string, unknown>;
              const different =
                changed === table &&
                !old.some((o) => JSON.stringify(o) === JSON.stringify(row));
              return (
                <tr
                  key={String(row.id ?? i)}
                  className={different ? "changed-row" : ""}
                >
                  {columns.map((c) => (
                    <td key={c}>
                      <span
                        className={c === "password_hash" ? "hash-cell" : ""}
                      >
                        {String(row[c] ?? "—")}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="empty-table">
            {filter
              ? "一致するレコードがありません。"
              : table === "sessions"
                ? "Sessionレコードはありません。ログインすると追加されます。"
                : "レコードはありません。"}
          </div>
        )}
      </div>
      {removed.length > 0 && changed === table && (
        <p className="notice">
          削除されたID：
          {removed.map((r) => (r as { id: string }).id).join(", ")}
        </p>
      )}
      <p className="inspector-note">
        このブラウザーの学習空間だけを表示しています。黄色は直前の記録から追加・変更されたレコードです。
      </p>
    </div>
  );
}
const headers: Record<string, string> = {
  "Set-Cookie":
    "サーバーからブラウザーへのCookie保存指示。フロントエンドのfetchではこのヘッダーを直接読めません。表示値はサーバーの発行記録です。",
  Cookie:
    "ブラウザーからサーバーへのname=value。HttpOnly/Secure/SameSite/Expiresなどの属性はCookieリクエストには含まれません。",
  "Content-Type": "本文のデータ形式。ここではapplication/json。",
  "Cache-Control": "no-storeにより認証レスポンスをキャッシュに保存させません。",
  Origin:
    "リクエストを開始したOrigin。変更APIではAPP_ORIGINとの完全一致を検証します。",
  "X-Lab-Request":
    "この学習アプリのfetchが付けるカスタムヘッダー。別OriginからはCORS preflightが必要です。",
  "X-Request-ID":
    "ひとつのAPI実行を識別するID。HTTP記録と実行イベントを結び付けます。",
};
export function HttpView({ runs }: { runs: Result[] }) {
  const [help, setHelp] = useState("");
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      {runs.length === 0 ? (
        <p className="empty-table">
          操作を実行すると、実際のAPI通信を表示します。
        </p>
      ) : (
        runs.map((r, i) => (
          <article className="http-exchange" key={r.requestId}>
            <div className="http-heading">
              <span className="method">{r.http.method}</span>
              <strong className="mono">{r.http.path}</strong>
              <span
                className={`http-status ${r.http.status >= 400 ? "error" : ""}`}
              >
                {r.http.status}
              </span>
              <small>#{i + 1}</small>
            </div>
            <div className="http-columns">
              <section>
                <h4>REQUEST</h4>
                {Object.entries(r.http.requestHeaders).map(([k, v]) => (
                  <div className="header-line" key={k}>
                    <button
                      onClick={() =>
                        setHelp(headers[k] ?? "この通信で使用したヘッダー。")
                      }
                    >
                      {k}
                    </button>
                    <code>{v}</code>
                  </div>
                ))}
                {r.http.requestBody !== undefined && (
                  <Code value={r.http.requestBody} />
                )}
              </section>
              <section>
                <h4>RESPONSE</h4>
                {Object.entries(r.http.responseHeaders).map(([k, v]) => (
                  <div className="header-line" key={k}>
                    <button
                      onClick={() =>
                        setHelp(headers[k] ?? "サーバーが返したヘッダー。")
                      }
                    >
                      {k}
                    </button>
                    <code>{v}</code>
                  </div>
                ))}
                <Code value={expanded ? r : r.http.responseBody} />
              </section>
            </div>
          </article>
        ))
      )}
      {help && (
        <div className="notice" role="status">
          {help}
        </div>
      )}
      <label className="inline-checkbox">
        <input
          type="checkbox"
          checked={expanded}
          onChange={(e) => setExpanded(e.target.checked)}
        />{" "}
        教育用メタデータを含むレスポンス全体も表示
      </label>
      <p className="inspector-note">
        アプリが扱う主要ヘッダーを表示（全パケットのキャプチャではありません）。通常の本文表示は認証結果の抜粋。実レスポンスにはtrace・state・httpも含みます。Passwordと学習空間IDは伏せています。
      </p>
    </div>
  );
}
export function BrowserView({ state }: { state: LabState | null }) {
  const [progress,setProgress]=useState<string|null>(null);
  useEffect(()=>{try{setProgress(localStorage.getItem('authlab-progress'));}catch{setProgress('読み取り不可');}},[]);
  const c = state?.cookie;
  return (
    <div>
      <div className="notice">
        HttpOnly
        CookieをJavaScriptで直接読んでいるわけではありません。サーバーの受信記録と設定を、教材専用APIから表示しています。実運用ではこのAPIを公開しません。
      </div>
      <div className="browser-grid">
        <section>
          <h3>Cookies</h3>
          {c ? (
            <>
              <dl className="data-list">
                {Object.entries(c)
                  .filter(([k]) => k !== "source")
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>
                        {v === null ? "不明（Requestに属性なし）" : String(v)}
                      </dd>
                    </div>
                  ))}
              </dl>
              <p className="inspector-note">{c.source}</p>
            </>
          ) : (
            <p className="empty-table">認証Cookieは受信されていません。</p>
          )}
          <p className="inspector-note">
            別にlab_space
            Cookieで学習空間を分離しています。lab_spaceはログインの証明には使いません。
          </p>
        </section>
        <section>
          <h3>Local Storage</h3>
          <Code
            value={{ "authlab-progress": progress ?? '未保存' }}
          />
          <p>ロードマップの学習済みチェックの実値です。認証情報は保存しません。</p>
          <h3>Session Storage</h3>
          <Code value="このアプリは使用しません。" />
          <h3>Cookieの3つの設定</h3>
          <dl className="definition-list">
            <dt>HttpOnly</dt>
            <dd>
              JavaScriptでの読み取りを禁止。XSSそのものや不正操作をすべて防ぐ設定ではありません。
            </dd>
            <dt>Secure</dt>
            <dd>
              原則HTTPSでのみ送信。今回はHTTP
              localhost用にfalse。HTTPS時はtrue必須。
            </dd>
            <dt>SameSite=Lax</dt>
            <dd>
              クロスサイト送信を制限。一部のトップレベルGET遷移は許可。CSRF対策をこれだけに頼りません。
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
export function RawView({
  steps,
  state,
  onSelect,
}: {
  steps: Step[];
  state: LabState | null;
  onSelect: (n: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const generated = steps.find(
    (s) => "session_id" in s.data && s.what === "Session IDを生成",
  );
  const id = generated?.data.session_id ?? state?.cookie?.value;
  const hash =
    steps.find((s) => s.data.password_hash)?.data.password_hash ??
    state?.snapshot.users[0]?.password_hash;
  async function copy() {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(String(id));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="raw-grid">
      <section>
        <h3>
          Session ID <span className="tag">実値</span>
        </h3>
        {id ? (
          <>
            <Code value={String(id)} />
            <button className="button small" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
              {copied ? "コピー済み" : "IDをコピー"}
            </button>
            <dl className="data-list">
              <div>
                <dt>Generated by</dt>
                <dd>Authentication Server / node:crypto</dd>
              </div>
              <div>
                <dt>Stored by</dt>
                <dd>Browser Cookie + PostgreSQL sessions</dd>
              </div>
              <div>
                <dt>Sent to</dt>
                <dd>同一OriginのApplication / API</dd>
              </div>
              <div>
                <dt>Purpose</dt>
                <dd>SessionからUserを引くための推測困難なキー</dd>
              </div>
              <div>
                <dt>DB Expiration</dt>
                <dd>
                  {state?.sessionExpires ??
                    "現在の有効なレコードなし（履歴の場合あり）"}
                </dd>
              </div>
            </dl>
            <div className="chip-row">
              {steps.map((s, i) =>
                JSON.stringify(s.data).includes(String(id)) ? (
                  <button
                    className="chip"
                    key={s.id}
                    onClick={() => onSelect(i)}
                  >
                    STEP {i + 1} · {s.location}
                  </button>
                ) : null,
              )}
            </div>
          </>
        ) : (
          <p className="empty-table">Sessionログインで生成されます。</p>
        )}
      </section>
      <section>
        <h3>
          Password Hash <span className="tag">bcrypt</span>
        </h3>
        <Code value={hash ?? "読み込み中"} />
        <p>
          同じデモパスワードでも、ランダムSaltにより保存値は異なります。元のパスワードへ「復号」はしません。
        </p>
        {typeof hash === "string" && (
          <dl className="data-list">
            <div>
              <dt>Algorithm</dt>
              <dd>{hash.slice(0, 4)}</dd>
            </div>
            <div>
              <dt>Cost</dt>
              <dd>{hash.slice(4, 6)}（2のCost乗に比例する処理量）</dd>
            </div>
            <div>
              <dt>Salt（encoded）</dt>
              <dd>{hash.slice(7, 29)}</dd>
            </div>
            <div>
              <dt>Generated by</dt>
              <dd>bcrypt / ユーザー初期化時</dd>
            </div>
            <div>
              <dt>Stored by</dt>
              <dd>PostgreSQL / users.password_hash</dd>
            </div>
            <div>
              <dt>Sent to</dt>
              <dd>認証サーバー内で利用。ブラウザー表示は教材専用。</dd>
            </div>
            <div>
              <dt>Expiration</dt>
              <dd>ハッシュ自体に期限なし</dd>
            </div>
          </dl>
        )}
        <p className="inspector-note">
          Session
          IDはBearer型の秘密情報です。この教材では観察目的で見せていますが、実運用でログや画面に出してはいけません。
        </p>
      </section>
    </div>
  );
}
