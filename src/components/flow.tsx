"use client";
import {
  UserRound,
  Monitor,
  AppWindow,
  Fingerprint,
  Server,
  Database,
} from "lucide-react";
import type { Step, Layer } from "@/lib/types";
const nodes: { id: Layer; label: string; sub: string; Icon: typeof Monitor }[] =
  [
    { id: "User", label: "User", sub: "資格情報を入力", Icon: UserRound },
    {
      id: "Browser",
      label: "Browser",
      sub: "Cookieを保持・送信",
      Icon: Monitor,
    },
    {
      id: "Client Application",
      label: "Client Application",
      sub: "UI・API呼び出し",
      Icon: AppWindow,
    },
    {
      id: "Authentication Server",
      label: "Authentication Server",
      sub: "資格情報を検証・Session発行",
      Icon: Fingerprint,
    },
    {
      id: "Resource API",
      label: "Resource API",
      sub: "Sessionを検証・認可",
      Icon: Server,
    },
    {
      id: "Database",
      label: "Database",
      sub: "users / sessions",
      Icon: Database,
    },
  ];
export function Flow({
  step,
  onLayer,
}: {
  step?: Step;
  onLayer: (l: Layer) => void;
}) {
  return (
    <div className="flow-area">
      <div className="flow-nodes">
        {nodes.map(({ id, label, sub, Icon }) => (
          <button
            key={id}
            className={`flow-node ${step?.location === id ? "current" : ""} ${step?.from === id || step?.to === id ? "involved" : ""}`}
            onClick={() => onLayer(id)}
          >
            <span className="node-icon">
              <Icon size={22} />
            </span>
            <strong>{label}</strong>
            <small>{sub}</small>
            {step?.location === id && (
              <span className="current-label">今ここ</span>
            )}
          </button>
        ))}
      </div>
      <div className="flow-transfer">
        <span className="mono">FROM</span>
        <strong>{step?.from ?? "User"}</strong>
        <span className="flow-arrow">→</span>
        <span className="mono">TO</span>
        <strong>{step?.to ?? "Browser"}</strong>
        <span className="protocol">{step?.protocol ?? "操作待ち"}</span>
      </div>
      <p className="flow-footnote">
        Authentication ServerとResource
        APIは、今回同じNext.js内の別の役割です。外部IdPは使いません。
      </p>
    </div>
  );
}
export const responsibilities: Record<Layer, string> = {
  User: "EmailとPasswordを入力する本人。Identityは誰か、Credentialはそれを証明する情報。",
  Browser:
    "Cookieストアを管理し、宛先・Path・Secure・SameSiteの条件を満たすリクエストにCookieを自動で添付。HttpOnlyはJavaScriptからの読み取りを禁止する。",
  "Client Application":
    "Reactで作る画面。ユーザー操作を受けてAPIを呼び出し、結果を表示する。サーバーの認証判定を代行しない。",
  "Authentication Server":
    "users検索、bcrypt照合、暗号学的乱数によるSession ID生成、Session Store保存、Set-Cookie発行を担当。今回はNext.js Route Handler。",
  "Resource API":
    "Profile/Adminの保護対象。各リクエストでSessionの存在・期限・User状態を検証し、必要に応じてroleを検証する。",
  Database:
    "PGlite（PostgreSQLの組み込み版）。同じNode.jsプロセス内で動き、dataフォルダーに保存。usersにはPassword Hash、sessionsにはSession IDとuser_id・有効期限を保存。認証状態はブラウザーではなく、サーバー側にも存在する。",
};
