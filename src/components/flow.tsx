"use client";
import {
  UserRound,
  Monitor,
  AppWindow,
  Fingerprint,
  Server,
  Database,
} from "lucide-react";
import { layerNames } from "@/lib/plain-language";
import type { Step, Layer } from "@/lib/types";
const nodes: { id: Layer; label: string; sub: string; Icon: typeof Monitor }[] =
  [
    { id: "User", label: "User", sub: "メールとパスワードを入力", Icon: UserRound },
    {
      id: "Browser",
      label: "Browser",
      sub: "Cookieを保持・送信",
      Icon: Monitor,
    },
    {
      id: "Client Application",
      label: "Client Application",
      sub: "操作を受けてサーバーに依頼",
      Icon: AppWindow,
    },
    {
      id: "Authentication Server",
      label: "Authentication Server",
      sub: "本人を確かめ、受付番号を発行",
      Icon: Fingerprint,
    },
    {
      id: "Resource API",
      label: "Resource API",
      sub: "番号と権限を確かめて応答",
      Icon: Server,
    },
    {
      id: "Database",
      label: "Database",
      sub: "登録情報・番号の対応表",
      Icon: Database,
    },
  ];
export function Flow({
  step,
  onLayer,
  engineer = false,
}: {
  step?: Step;
  engineer?: boolean;
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
            <strong>{engineer ? label : layerNames[id]}</strong>
            <small>{sub}</small>
            {step?.location === id && (
              <span className="current-label">今ここ</span>
            )}
          </button>
        ))}
      </div>
      <div className="flow-transfer">
        <span className="mono">FROM</span>
        <strong>{step ? (engineer ? step.from : layerNames[step.from]) : "あなた"}</strong>
        <span className="flow-arrow">→</span>
        <span className="mono">TO</span>
        <strong>{step ? (engineer ? step.to : layerNames[step.to]) : "ブラウザ"}</strong>
        <span className="protocol">{step?.protocol ?? "操作待ち"}</span>
      </div>
      <p className="flow-footnote">
        緑の「今ここ」が選択中のステップです。各カードを押すと、その役割を確認できます。
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

export const simpleResponsibilities: Record<Layer, string> = {
 User: '画面を操作する人です。メールアドレスとパスワードを入力します。',
 Browser: 'ChromeやSafariなどです。Cookieに受付番号を保存し、条件に合うアクセスに自動で付けます。このアプリの認証Cookieは、画面のJavaScriptから直接読めません。',
 'Client Application': 'ブラウザの中で動く操作画面です。ボタン操作を受けてサーバーに処理を頼み、結果を表示します。本人かどうかを最終判断するのはサーバーです。',
 'Authentication Server': 'メールアドレスとパスワードで本人を確かめる窓口です。ログイン成功時には受付番号を作り、DBに保存してからブラウザに渡します。',
 'Resource API': 'プロフィールなどの情報を返す窓口です。アクセスのたびに受付番号の記録や期限を確認します。管理者向けの操作では権限も確認します。',
 Database: 'サーバー側の保管庫です。登録情報と、受付番号・利用者・期限の対応表を保存します。このアプリではDBも内蔵されているので、別にインストールする必要はありません。',
};
