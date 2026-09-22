"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Fingerprint,
  LayoutGrid,
  KeyRound,
  Workflow,
  Database,
  ArrowUpRight,
  LockKeyhole,
} from "lucide-react";
const nav = [
  ["/", "学習ロードマップ", LayoutGrid],
  ["/password", "Password認証", KeyRound],
  ["/session", "Session認証", Workflow],
  ["/jwt", "JWT認証", KeyRound],
  ["/compare", "SessionとJWTの比較", Workflow],
  ["/tokens", "AccessとRefresh", KeyRound],
  ["/database", "Database Viewer", Database],
] as const;
/**
 * 公開デモとして動いているか。
 *
 * ローカル実行と公開デモでは、学習データの扱いが違う
 * （公開デモはメモリ上だけで持つため、時間をおくと消えることがある）。
 * 「ローカル実験用」と表示したままだと事実と違うので、表示を切り替える。
 * クライアント側で読むので NEXT_PUBLIC_ 接頭辞が要る（ビルド時に埋め込まれる）。
 */
const hosted = process.env.NEXT_PUBLIC_LAB_HOSTED === "true";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Fingerprint size={27} />
          </span>
          <span>
            AUTH<span className="brand-thin"> / LAB</span>
            <small>Authentication Learning Lab</small>
          </span>
        </Link>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="メインナビゲーション">
          {nav.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "nav-link active" : "nav-link"}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
              {path === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-course">
          <span className="eyebrow">いま学ぶテーマ</span>
          <h3>Session authentication</h3>
          <p>
            「ログイン済み」は
            <br />
            どこに保存される？
          </p>
          <Link href="/session">
            実験を開く <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="sidebar-footer">
          <LockKeyhole size={16} />
          <div>
            {hosted ? "HOSTED DEMO" : "LOCAL LEARNING ENVIRONMENT"}
            <small>PHASE 01 — 09</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Learning workspace <span className="muted">/</span>{" "}
            <strong>{nav.find((n) => n[0] === path)?.[1] ?? "Auth Lab"}</strong>
          </span>
          <span className="environment">
            {hosted ? "公開デモ" : "ローカル実験用"}{" "}
            <span className="mono">v1.9</span>
          </span>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
