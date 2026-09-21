'use client';
import { useState } from 'react';
import { Database, Server, ShieldCheck } from 'lucide-react';

export function CompareModel({ kind }: { kind: 'revocation' | 'scale' }) {
  const [choice, setChoice] = useState(0);
  const options = kind === 'revocation' ? ['失効リストなし', '失効リストあり'] : ['Session', 'JWT', 'JWT＋失効リスト'];
  return <section className="compare-model" aria-label="設計の説明モデル">
    <strong className="compare-model-label">説明モデル · 実API・DBは変わりません</strong>
    <div className="compare-switches" role="group" aria-label="設計を切り替える">{options.map((name, i) => <button key={name} aria-pressed={choice === i} onClick={() => setChoice(i)}>{name}</button>)}</div>
    {kind === 'revocation' ? <>
      <p>前提：コピーしたJWTの署名と期限は有効。発行後に「このJWTを止めたい」と決めた場面です。</p>
      <div className="compare-model-cards"><div><ShieldCheck size={22} /><strong>検証API</strong><p>署名・iss・aud・expなどを確認</p></div><div data-shared={choice === 1}><Database size={22} /><strong>{choice === 0 ? '個別の失効情報を参照しない' : '失効リストも照会'}</strong><p>{choice === 0 ? 'トークンには発行後の停止決定が書き込まれない' : 'jti等が停止対象かを確認する状態を追加'}</p></div></div>
      <p className="compare-model-answer" aria-live="polite">{choice === 0 ? '公開鍵だけでは、そのJWTについて後から決めた個別停止を知れません。短命化なら使える時間を短くできますが、期限までは待つ設計です。' : 'JWTを個別に失効させる構成は作れます。ただし、失効情報の保存・照会・更新が必要です。「JWTだから常に状態なし」とは言えなくなります。'}</p>
      <small>ここでは失効リストのAPI・テーブルは実装していません。鍵変更でまとめて止める方法は影響範囲が異なり、個別失効と区別します。</small>
    </> : <>
      <div className="compare-model-cards">{['APIサーバーA', 'APIサーバーB'].map(name => <div key={name}><Server size={22} /><strong>{name}</strong><p>{choice === 0 ? '同じSession Storeから有効状態を照会' : '同じ公開鍵・検証条件でJWTを確認'}</p>{choice === 2 && <small>失効リストも照会</small>}</div>)}</div>
      <div className="compare-shared"><Database size={21} /><div><strong>{choice === 0 ? '共有Session Store' : choice === 1 ? '公開鍵と検証設定を配布' : '公開鍵・検証設定 ＋ 共有失効リスト'}</strong><p>{choice === 0 ? '両方のサーバーから状態の更新が見えるようにする' : choice === 1 ? '秘密鍵を各検証サーバーへ配る必要はない' : 'どのサーバーでも同じ停止判断ができるようにする'}</p></div></div>
      <p className="compare-model-answer" aria-live="polite">{choice === 0 ? 'Sessionも共有ストアで増設できます。ストアへの照会負荷・可用性・キャッシュや複製の反映遅延を考えます。' : choice === 1 ? '個別Sessionの照会は省けますが、鍵の更新、検証ルール、時計の管理は必要です。署名検証の計算負荷もあり、常にJWTの方が速いとは限りません。' : '個別失効を加えると、サーバー間で共有する状態が増えます。キャッシュや複製の反映が遅れる間は、停止判断がそろわない可能性があります。'}</p>
      <small>本アプリは単一Nodeプロセス・組み込みPGliteです。2台の稼働、障害、性能の実測を示す図ではありません。</small>
    </>}
  </section>;
}
