"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  FlaskConical,
  LockKeyhole,
  Route,
  Database,
} from "lucide-react";
const levels = [
  ["Identity / Credential", "「誰か」と「証拠」を区別する", "/password"],
  ["Password Authentication", "入力した資格情報を検証する", "/password"],
  ["Password Hashing", "Saltとハッシュの役割を知る", "/password"],
  ["Cookie", "ブラウザーが送るデータを見る", "/session"],
  ["Session Authentication", "IDとユーザーの対応を追う", "/session"],
  ["Authorization 基礎", "401と403を使い分ける", "/session"],
  ["JWT", "予想して署名・期限・改ざんを確かめる", "/jwt"],
  ["Session vs JWT", "認証状態の保存方法を比較"],
  ["Access / Refresh Token", "有効期限と更新"],
  ["OAuth 2.0", "APIアクセスの認可委譲"],
  ["OpenID Connect", "ユーザーの本人確認"],
  ["OAuth vs OIDC", "目的とトークンを比較"],
  ["Authorization Code Flow", "コードをトークンに交換"],
  ["PKCE", "コード横取りへの対策"],
  ["SSO", "複数アプリのログイン"],
  ["MFA", "複数要素による本人確認"],
  ["Passkey / WebAuthn", "公開鍵による認証"],
  ["Authentication Security", "攻撃と防御を実験"],
];
export function Dashboard() {
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem("authlab-progress") ?? "[]");
      if (Array.isArray(d))
        setDone(
          d.filter((x: unknown) => typeof x === "number" && x >= 0 && x < 7),
        );
    } catch {}
  }, []);
  function toggle(i: number) {
    const next = done.includes(i) ? done.filter((n) => n !== i) : [...done, i];
    setDone(next);
    localStorage.setItem("authlab-progress", JSON.stringify(next));
  }
  return (
    <div className="page dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">LEARN BY OBSERVING</span>
          <h1>認証の、その内側へ。</h1>
          <p>操作して、データを追って、自分の言葉で説明する。</p>
        </div>
        <span className="phase-pill">
          PHASE 1–7 <Check size={14} />
        </span>
      </div>
      <section className="start-panel">
        <div>
          <span className="tag">
            <FlaskConical size={15} /> SESSION LAB
          </span>
          <h2>
            ログインの裏側を、
            <br />
            ひとつずつ辿ろう。
          </h2>
          <p>
            パスワードの照合からSessionの生成、
            <br />
            Cookie送信とAPIの本人確認まで。
          </p>
          <Link className="button primary" href="/session">
            Session認証を実験する <ArrowRight size={18} />
          </Link>
          <div className="start-meta">
            <Clock3 size={15} /> 目安 30〜60分{" "}
            <span>実API / 実Cookie / PGlite</span>
          </div>
        </div>
        <div className="concept-stack">
          <div className="concept-card">
            <span className="concept-num">01</span>
            <div>
              <strong>Browser</strong>
              <p>CookieにSession IDを保持</p>
            </div>
            <LockKeyhole size={23} />
          </div>
          <div className="connection-label">HTTP Request · Cookie ↓</div>
          <div className="concept-card emphasized">
            <span className="concept-num">02</span>
            <div>
              <strong>Application / API</strong>
              <p>受信したIDでSessionを検索</p>
            </div>
            <Route size={23} />
          </div>
          <div className="connection-label">Session lookup ↓</div>
          <div className="concept-card">
            <span className="concept-num">03</span>
            <div>
              <strong>Session Store</strong>
              <p>Session ID ↔ User ID / 有効期限</p>
            </div>
            <Database size={23} />
          </div>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">LEARNING ROADMAP</span>
          <h2>学習ロードマップ</h2>
        </div>
        <div className="course-progress">
          <span>
            <b>{done.length}</b> / 7 学習済み
          </span>
          <progress value={done.length} max={7} />
        </div>
      </div>
      <p className="muted">
        理解できた項目にチェック。チェックはこのブラウザーに保存されます。
      </p>
      <div className="level-grid">
        {levels.map(([title, desc, href], i) => (
          <article
            key={title}
            className={`level-card ${href ? "" : "future"} ${done.includes(i) ? "complete" : ""}`}
          >
            <div className="level-top">
              <span className="mono">
                LEVEL {String(i + 1).padStart(2, "0")}
              </span>
              {href ? (
                <button
                  className="check-button"
                  aria-label={`${title}を学習済みにする`}
                  aria-pressed={done.includes(i)}
                  onClick={() => toggle(i)}
                >
                  {done.includes(i) && <Check size={15} />}
                </button>
              ) : (
                <span className="future-label">今後のPHASE</span>
              )}
            </div>
            <h3>
              {href ? (
                <Link href={href}>
                  {title}
                  <ArrowRight size={17} />
                </Link>
              ) : (
                title
              )}
            </h3>
            <p>{desc}</p>
          </article>
        ))}
      </div>
      <section className="understanding">
        <h2>ここまで説明できれば、Session編は修了。</h2>
        <div>
          <p>
            01 <strong>CookieとSessionは、何が違う？</strong>
          </p>
          <p>
            02 <strong>なぜ毎回パスワードを送らない？</strong>
          </p>
          <p>
            03 <strong>Cookieがあるのに401になるのはなぜ？</strong>
          </p>
          <p>
            04 <strong>ログアウトで何を削除する？</strong>
          </p>
        </div>
        <p className="muted">
          このバージョンではLEVEL
          1〜7を扱います。Session比較・OAuth・OIDC以降は設計書に拡張方針を記載しています。
        </p>
      </section>
    </div>
  );
}
