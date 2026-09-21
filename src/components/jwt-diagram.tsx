'use client';
import { Monitor, Server, Database } from 'lucide-react';
import { tokenLabel, type JwtObservation } from '@/lib/jwt-learning';

export function JwtDiagram({ observation, frame, token }: { observation: JwtObservation | null; frame: number; token: string | null }) {
  const finished = !!observation && frame >= observation.steps.length;
  const step = observation?.steps[frame];
  const issuing = observation?.action === 'issue' || observation?.action === 'short';
  const signing = observation?.steps.findIndex(s => s.title === '秘密鍵でJWTに署名') ?? -1;
  const saved = observation?.steps.findIndex(s => s.title === 'JWTを画面内メモリーに保持') ?? -1;
  const browserToken = !observation ? token : finished || (saved >= 0 && frame >= saved) ? observation.afterToken : observation.beforeToken;
  const handledToken = !step || step.place !== 'server' ? null : issuing ? signing >= 0 && frame >= signing ? observation?.afterToken ?? null : null : observation?.sentToken ?? null;
  const count = observation?.result ? (finished ? observation.result.after : observation.result.before).sessions.length : null;
  return <div className="jwt-map" aria-label="JWTの保存・一時利用・DB記録">
    <div data-current={step?.place === 'browser'}><Monitor size={23} /><strong>ブラウザ</strong><span>保存（画面内メモリー）</span><code>{tokenLabel(browserToken)}</code><small>Cookieには入れません</small></div>
    <div data-current={step?.place === 'server'}><Server size={23} /><strong>サーバー</strong><span>一時利用</span>{handledToken ? <code>{tokenLabel(handledToken)}</code> : <code>{finished ? '処理終了' : step?.place === 'server' ? '本人確認・発行準備' : '待機中'}</code>}<small>署名鍵は別途保存</small></div>
    <div data-current={step?.place === 'database'}><Database size={23} /><strong>DB</strong><span>記録</span><code>{count === null ? '未観測' : `Session ${count}件`}</code><small>usersは本人確認用</small></div>
    <p>図の配置・強調は説明モデルです。値は選択した操作の記録。DB件数は{finished ? '操作後' : '操作前'}の観測値です。処理終了の表示は実メモリー消去を意味しません。</p>
  </div>;
}
