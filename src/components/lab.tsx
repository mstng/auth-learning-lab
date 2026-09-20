"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
  LogOut,
  Clock3,
  ShieldCheck,
  KeyRound,
  Activity,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { Result, LabState, Step, Layer } from "@/lib/types";
import { Flow, responsibilities, simpleResponsibilities } from "./flow";
import { Sequence } from "./sequence";
import { LearningGuide } from "./learning-guide";
import { layerNames, plainStep } from "@/lib/plain-language";
import {
  Code,
  DatabaseView,
  HttpView,
  BrowserView,
  RawView,
} from "./inspectors";
type Mode = "session" | "password" | "database";
const tabs = [
  ["http", "HTTP"],
  ["browser", "Browser State"],
  ["database", "Database"],
  ["logs", "Server Logs"],
  ["raw", "Raw Data"],
  ["sequence", "Sequence"],
] as const;
const missions = [
  ["ログインとProfileを実行", "CookieのIDとDBのIDは一致している？"],
  ["間違ったPasswordで実行", "新しいSessionは作られた？"],
  ["DBの期限を切らしてProfileを実行", "Cookieがあっても401になる？"],
  ["userでAdmin APIを実行", "401と403の違いを説明できる？"],
  ["ログアウト後にProfileを実行", "CookieとDBの両方が変化した？"],
];
async function request(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`/api/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "X-Lab-Request": "1",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  const data = await res.json();
  if (!res.ok && !data.trace)
    throw new Error(data.message ?? "通信に失敗しました。");
  return data;
}
export function Lab({ mode }: { mode: Mode }) {
  const [state, setState] = useState<LabState | null>(null),
    [runs, setRuns] = useState<Result[]>([]),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [playing, setPlaying] = useState(false),
    [engineer, setEngineer] = useState(false),
    [tab, setTab] = useState("http"),
    [email, setEmail] = useState("sample@example.com"),
    [password, setPassword] = useState("LearnSession!2026"),
    [ttl, setTtl] = useState(300),
    [selectedLayer, setSelectedLayer] = useState<Layer | null>(null),
    [missionDone, setMissionDone] = useState<number[]>([]),
    [dbHistory, setDbHistory] = useState(true);
  const booted = useRef(false),
    locked = useRef(false);
  const steps = runs.flatMap((r) => r.trace);
  const step = steps[index];
  const simple = plainStep(step);
  const refresh = useCallback(async () => {
    const data = await request("lab/state");
    setState(data.state);
  }, []);
  const init = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await request("lab/init", "POST");
      setState(data.state);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void init();
  }, [init]);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (index >= steps.length - 1) setPlaying(false);
      else setIndex(index + 1);
    }, 1800);
    return () => clearTimeout(timer);
  }, [playing, index, steps.length]);
  async function run(action: string, body?: unknown) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setPlaying(false);
    setSelectedLayer(null);
    let collected: Result[] = [];
    try {
      const post = !["profile", "admin"].includes(action);
      const first: Result = await request(action, post ? "POST" : "GET", body);
      collected = [first];
      setState(first.state);
      if (action === "login" && first.success) {
        const profile: Result = await request("profile");
        collected.push(profile);
        setState(profile.state);
      }
      setRuns(collected);
      setIndex(0);
      setMessage(collected.at(-1)?.message ?? "");
      if (action === "lab/reset") {
        setRuns([]);
        setMessage(first.message);
      }
    } catch (e) {
      if (collected.length) {
        setRuns(collected);
        setIndex(0);
      }
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const isPassword = mode === "password";
  const title =
    mode === "database"
      ? "Database Viewer"
      : isPassword
        ? "Password認証"
        : "Session認証";
  const selectedSnapshot =
    dbHistory && step?.snapshot ? step.snapshot : state?.snapshot;
  const previous = index > 0 ? steps[index - 1]?.snapshot : undefined;
  function select(n: number) {
    setIndex(n);
    setPlaying(false);
    setSelectedLayer(null);
  }
  return (
    <div className="page lab-page">
      <div className="page-heading compact">
        <div>
          <span className="eyebrow">
            {mode === "database"
              ? "PERSISTENCE INSPECTOR"
              : isPassword
                ? "LAB 01 / CREDENTIAL VERIFICATION"
                : "LAB 02 / SERVER-SIDE SESSION"}
          </span>
          <h1>
            {title}
            <span className="title-sub">
              {isPassword
                ? "本人確認のはじまり"
                : mode === "database"
                  ? "認証データの実体"
                  : "ログイン状態はどこにある？"}
            </span>
          </h1>
          <p>
            {mode === "database"
              ? "組み込みDB（PGlite）に保存された、この学習空間のレコードです。"
              : isPassword
                ? "まずは、入力したパスワードで本人かどうかを確かめます。"
                : "なぜ、ログインした後はパスワードを毎回入力しなくてよいのでしょう？"}
          </p>
        </div>
        <button
          className="button small"
          disabled={busy}
          onClick={() => void run("lab/reset")}
        >
          <RotateCcw size={15} /> 実験を初期化
        </button>
      </div>
      <div aria-live="polite">
        {error && (
          <div className="notice error">
            <AlertCircle size={17} />
            {error}
            <button className="button small" onClick={() => void init()}>
              再接続
            </button>
          </div>
        )}
        {message && !error && (
          <div
            className={`result-message ${runs.at(-1)?.success === false ? "failure" : ""}`}
          >
            <Activity size={16} />
            {message}
          </div>
        )}
      </div>
      {mode === "database" ? (
        <section className="panel">
          <div className="panel-heading">
            <h2>Database / 現在の状態</h2>
            <button
              disabled={busy}
              className="button small"
              onClick={() => void refresh().catch((e) => setError(e.message))}
            >
              <RefreshCw size={14} />
              更新
            </button>
          </div>
          <DatabaseView snapshot={state?.snapshot} />
          <p>
            <Link href="/session">Session認証の実験へ →</Link>
          </p>
        </section>
      ) : (
        <>
          <LearningGuide password={isPassword} />
          <div className="lab-grid">
            <section className="panel operation-panel">
              <div className="panel-heading">
                <h2>
                  <span className="section-number">01</span> 操作する
                </h2>
                <span className="eyebrow">USER OPERATION</span>
              </div>
              <div className="operation-content">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(isPassword ? "password" : "login", {
                      email,
                      password,
                      ttl,
                    });
                  }}
                >
                  <label htmlFor="account">デモユーザー</label>
                  <select
                    id="account"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                  >
                    <option value="sample@example.com">
                      一般ユーザー · user
                    </option>
                    <option value="admin@example.com">管理者 · admin</option>
                  </select>
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                    required
                  />
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                    autoComplete="off"
                    required
                  />
                  <p className="field-note">
                    学習用Passwordを入力済み。
                    <br />
                    照合結果・ログには平文を残しません。
                  </p>
                  {!isPassword && (
                    <>
                      <label htmlFor="ttl">Sessionの有効期限</label>
                      <select
                        id="ttl"
                        value={ttl}
                        onChange={(e) => setTtl(Number(e.target.value))}
                        disabled={busy}
                      >
                        <option value={300}>5分 · 通常の実験</option>
                        <option value={15}>15秒 · 自然な期限切れを観察</option>
                      </select>
                    </>
                  )}
                  <button
                    className="button primary full"
                    type="submit"
                    disabled={busy || !state}
                  >
                    {busy
                      ? "接続・実行中…"
                      : isPassword
                        ? "パスワードを照合"
                        : "ログイン → Profile"}
                    <ArrowRight size={17} />
                  </button>
                </form>
                <button
                  className="text-button"
                  disabled={busy || !state}
                  onClick={() =>
                    void run(isPassword ? "password" : "login", {
                      email,
                      password: "WrongPassword!",
                      ttl,
                    })
                  }
                >
                  間違ったPasswordで試す <ChevronRight size={14} />
                </button>
                <div className="operation-divider" />
                <span className="eyebrow">
                  {isPassword ? "照合後の確認" : "ログイン後の実験"}
                </span>
                <div className="action-list">
                  <button
                    disabled={busy || !state}
                    onClick={() => void run("profile")}
                  >
                    <ShieldCheck size={17} />
                    <span>
                      自分の情報を見る<small>Profile API · GET /api/profile</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                  <button
                    disabled={busy || !state}
                    onClick={() => void run("admin")}
                  >
                    <KeyRound size={17} />
                    <span>
                      管理者だけの操作<small>Admin API · GET /api/admin</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                  {!isPassword && (
                    <button
                      disabled={busy || !state}
                      onClick={() => void run("lab/expire")}
                    >
                      <Clock3 size={17} />
                      <span>
                        DBの期限を切らす<small>Cookieを残して失効させる</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  )}
                  <button
                    disabled={busy || !state}
                    onClick={() => void run("logout")}
                  >
                    <LogOut size={17} />
                    <span>
                      ログアウト<small>SessionとCookieを削除</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                </div>
                {isPassword && (
                  <p className="notice">
                    このページの照合APIはSessionを作りません。未ログイン状態で照合後にProfileを呼ぶと401になります。
                  </p>
                )}
              </div>
            </section>
            <section className="panel flow-panel">
              <div className="panel-heading">
                <h2>
                  <span className="section-number">02</span> 内部を辿る
                </h2>
                <span className="tag">
                  {steps.length ? "実行記録を再生" : "DATA FLOW"}
                </span>
              </div>
              <div className="current-step">
                <span className="step-index">
                  {steps.length ? String(index + 1).padStart(2, "0") : "—"}
                  <small>/ {String(steps.length).padStart(2, "0")}</small>
                </span>
                <div>
                  <span className="eyebrow">CURRENT LOCATION</span>
                  <h3>{step ? (engineer ? step.location : layerNames[step.location]) : "操作を待っています"}</h3>
                  <p>
                    {step ? (engineer ? step.what : simple?.title) : "「操作する」のボタンから実際の認証を実行します。"}
                  </p>
                  {step && !engineer && <small className="technical-caption">{step.location} · {step.what}</small>}
                </div>
              </div>
              <Flow engineer={engineer} step={step} onLayer={setSelectedLayer} />
              {selectedLayer && (
                <div className="layer-detail">
                  <strong>{layerNames[selectedLayer]} <small> / {selectedLayer}</small></strong>
                  <p>{engineer ? responsibilities[selectedLayer] : simpleResponsibilities[selectedLayer]}</p>
                  <button
                    className="text-button"
                    onClick={() => setSelectedLayer(null)}
                  >
                    閉じる
                  </button>
                </div>
              )}
              <div className="player">
                <button
                  className="icon-button"
                  aria-label="前のステップ"
                  disabled={!steps.length || index === 0}
                  onClick={() => select(index - 1)}
                >
                  <ArrowLeft size={17} />
                </button>
                <button
                  className="button small"
                  disabled={!steps.length}
                  onClick={() => {
                    if (index === steps.length - 1) setIndex(0);
                    setPlaying(!playing);
                  }}
                >
                  {playing ? <Pause size={15} /> : <Play size={15} />}{" "}
                  {playing ? "停止" : "自動再生"}
                </button>
                <input
                  type="range"
                  aria-label="再生ステップ"
                  min={0}
                  max={Math.max(0, steps.length - 1)}
                  value={index}
                  disabled={!steps.length}
                  onChange={(e) => select(Number(e.target.value))}
                />
                <button
                  className="button dark small"
                  disabled={!steps.length || index >= steps.length - 1}
                  onClick={() => select(index + 1)}
                >
                  次へ <ArrowRight size={16} />
                </button>
              </div>
              <p className="playback-note">
                APIは通常どおり実行済みです。「次へ」は記録の再生で、サーバー処理の一時停止ではありません。
              </p>
              <div className="explanation">
                <div className="explanation-heading">
                  <h3>このステップで何が起きた？</h3>
                  <div className="segmented" aria-label="説明レベル">
                    <button
                      aria-pressed={!engineer}
                      className={!engineer ? "selected" : ""}
                      onClick={() => setEngineer(false)}
                    >
                      やさしく
                    </button>
                    <button
                      aria-pressed={engineer}
                      className={engineer ? "selected" : ""}
                      onClick={() => setEngineer(true)}
                    >
                      詳しく
                    </button>
                  </div>
                </div>
                {step ? engineer ? <p>{step.engineer}</p> : <div className="plain-explanation">
                  <div><span>何が起きた？</span><p>{simple?.what}</p></div>
                  <div><span>なぜ必要？</span><p>{simple?.why}</p></div>
                  <div className="observation-tip"><span>ここに注目</span><p>{simple?.look}</p></div>
                </div> : <p>操作後に「次へ」を押すと、何が起きたかを1つずつ確認できます。最初は実データをすべて読まなくても大丈夫です。</p>}
                {step && <>
                  <details key={engineer ? "technical-open" : "technical-closed"} open={engineer} className="step-technical">
                    <summary>実データと技術用語も見る</summary>
                    {!engineer && <p>{step.engineer}</p>}
                    <div className="step-facts"><div><span>誰が作った？</span><strong>{step.generatedBy}</strong></div><div><span>どこに保存？</span><strong>{step.storedBy}</strong></div></div>
                    <Code value={step.data} />
                  </details>
                  <span className="evidence-label">{step.evidence === "server" ? "サーバーで実行・記録" : "ブラウザー動作の説明（API実行に対応）"}</span>
                </>}
              </div>
            </section>
            <aside className="panel state-panel">
              <div className="panel-heading">
                <h2>
                  <span className="section-number">03</span> 状態を見る
                </h2>
                <button
                  className="icon-button"
                  aria-label="現在の状態を更新"
                  disabled={busy}
                  onClick={() =>
                    void refresh().catch((e) => setError(e.message))
                  }
                >
                  <RefreshCw size={15} />
                </button>
              </div>
              <div className="state-content">
                <span className="eyebrow">LIVE STATE · 現在</span>
                <div
                  className={`auth-state ${state?.authenticated ? "authenticated" : ""}`}
                >
                  <ShieldCheck size={23} />
                  <strong>
                    {busy && !state
                      ? "接続中"
                      : state?.authenticated
                        ? "ログイン中"
                        : "未ログイン"}
                  </strong>
                </div>
                <dl className="state-list">
                  <dt>User</dt>
                  <dd>{state?.user?.email ?? "—"}</dd>
                  <dt>Role</dt>
                  <dd>
                    <span className="role-badge">
                      {state?.user?.role ?? "—"}
                    </span>
                  </dd>
                  <dt>Cookie / Session</dt>
                  <dd>{state?.sessionStatus ?? "—"}</dd>
                  <dt>Session records</dt>
                  <dd className="count">
                    {state?.snapshot.sessions.length ?? 0}
                    <small> PGlite</small>
                  </dd>
                  <dt>DB expires_at</dt>
                  <dd className="mono">
                    {state?.sessionExpires
                      ? new Date(state.sessionExpires).toLocaleTimeString(
                          "ja-JP",
                        )
                      : "—"}
                  </dd>
                </dl>
                <div className="state-callout">
                  <strong>
                    ブラウザーには「ID」。
                    <br />
                    サーバーには「対応表」。
                  </strong>
                  <p>
                    サーバーが番号の対応表を調べて、誰のアクセスかを確かめます。番号があっても、期限切れなら使えません。
                  </p>
                </div>
                <p className="inspector-note">
                  {state?.transport ?? "接続待ち"}
                  <br />
                  更新時刻{" "}
                  {state
                    ? new Date(state.serverTime).toLocaleTimeString("ja-JP")
                    : "—"}
                  <br />
                  自然な期限切れはAPI呼び出し・更新で確認。
                </p>
              </div>
            </aside>
          </div>
          <section className="panel inspector">
            <div className="inspector-heading">
              <h2>データを観察する</h2>
              <span className="muted">実行した値から、仕組みをつなげる</span>
            </div>
            <div className="tabs" role="tablist" aria-label="データビューア">
              {tabs.map(([id, label]) => (
                <button
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`panel-${id}`}
                  id={`tab-${id}`}
                  key={id}
                  className={tab === id ? "selected" : ""}
                  onClick={() => setTab(id)}
                >
                  {{http: "通信", browser: "ブラウザの保存内容", database: "DBの中身", logs: "処理の記録", raw: "値の実物", sequence: "順番の図"}[id]}<small className="tab-technical">{label}</small>
                  {id === "http" && runs.length > 0 && (
                    <span>{runs.length}</span>
                  )}
                </button>
              ))}
            </div>
            <div
              className="inspector-body"
              role="tabpanel"
              id={`panel-${tab}`}
              aria-labelledby={`tab-${tab}`}
            >
              {tab === "http" && <HttpView runs={runs} />}{" "}
              {tab === "browser" && <BrowserView state={state} />}
              {tab === "sequence" && <Sequence steps={steps} index={index} onSelect={select}/>}
              {tab === "database" && (
                <>
                  <div className="snapshot-control">
                    <span className="tag">
                      {dbHistory && step?.snapshot
                        ? `STEP ${index + 1} 時点の記録`
                        : "現在の状態"}
                    </span>
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={dbHistory}
                        onChange={(e) => setDbHistory(e.target.checked)}
                      />{" "}
                      選択ステップのDBを表示
                    </label>
                  </div>
                  <DatabaseView
                    snapshot={selectedSnapshot}
                    previous={dbHistory ? previous : undefined}
                    changed={dbHistory ? step?.changed : undefined}
                  />
                </>
              )}
              {tab === "logs" && (
                <div className="trace-log">
                  {!steps.length ? (
                    <p className="empty-table">
                      操作すると時系列の実行イベントが表示されます。
                    </p>
                  ) : (
                    steps.map((s, i) => (
                      <button
                        key={s.id}
                        className={index === i ? "selected" : ""}
                        onClick={() => select(i)}
                      >
                        <span className="mono">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <time>
                          {new Date(s.at).toLocaleTimeString("ja-JP")}
                        </time>
                        <span className="log-location">{s.location}</span>
                        <strong>{s.what}</strong>
                        <small>
                          {s.evidence === "server" ? "実行記録" : "動作説明"}
                        </small>
                      </button>
                    ))
                  )}
                </div>
              )}
              {tab === "raw" && (
                <RawView steps={steps} state={state} onSelect={select} />
              )}
            </div>
          </section>
          <section className="learning-missions">
            <div>
              <span className="eyebrow">TRY & EXPLAIN</span>
              <h2>
                {isPassword
                  ? "Password認証を理解する"
                  : "5つの実験で、理解を確かめる"}
              </h2>
              <p>
                {isPassword
                  ? "ハッシュの実物はRaw Dataタブで確認できます。"
                  : "チェックはこの画面を開いている間だけ保持します。"}
              </p>
            </div>
            {isPassword ? (
              <div className="password-lessons">
                <article>
                  <h3>IdentityとCredential</h3>
                  <p>
                    Emailは「誰か」を示す識別子。Passwordは本人であることを示す証拠です。Emailを知っているだけでは認証できません。
                  </p>
                </article>
                <article>
                  <h3>SaltとHash</h3>
                  <p>
                    Saltはハッシュごとに生成する乱数。秘密にする必要はなく、bcryptの出力に含まれます。同じPasswordでも異なるHashになります。
                  </p>
                </article>
                <article>
                  <h3>なぜ遅いハッシュ？</h3>
                  <p>
                    bcryptのCostは総当たりのコストを上げます。一般的なSHA-256だけでPasswordを保存する設計は避けます。新規実装ではArgon2idも有力です。
                  </p>
                </article>
                <Link href="/session" className="button primary">
                  続いてSessionを学ぶ <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="missions">
                {missions.map(([title, desc], i) => (
                  <button
                    key={title}
                    aria-pressed={missionDone.includes(i)}
                    onClick={() =>
                      setMissionDone((d) =>
                        d.includes(i) ? d.filter((n) => n !== i) : [...d, i],
                      )
                    }
                  >
                    <span
                      className={`mission-check ${missionDone.includes(i) ? "done" : ""}`}
                    >
                      {missionDone.includes(i) ? (
                        <CheckCircle2 size={21} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    <span>
                      <strong>{title}</strong>
                      <small>{desc}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      <footer className="lab-footer">
        教育用のダミーデータだけを使用してください。認証データの可視化APIはローカル学習専用です。
        <br />
        実装根拠：
        <a
          href="https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html"
          target="_blank"
          rel="noreferrer"
        >
          OWASP Session Management
        </a>{" "}
        ·{" "}
        <a
          href="https://nextjs.org/docs/app/api-reference/functions/cookies"
          target="_blank"
          rel="noreferrer"
        >
          Next.js Cookies
        </a>
      </footer>
    </div>
  );
}
