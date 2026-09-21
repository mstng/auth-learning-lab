'use client';
import { useState } from 'react';
import { readJwt } from '@/lib/jwt-learning';

const claims = [
  ['sub', '誰についての情報か（利用者ID）'], ['iss', '誰が発行したか'],
  ['aud', 'どのAPI宛てか'], ['iat', 'いつ発行したか'], ['exp', 'いつまで使えるか'],
  ['jti', 'このJWTの識別子（失効管理は別途必要）'], ['lab', 'どの学習空間向けか'],
] as const;
export function JwtParts({ token, detailed }: { token: string; detailed: boolean }) {
  const [part, setPart] = useState(1);
  let decoded;
  try { decoded = readJwt(token); } catch { return <p role="alert">この値はJWTとして分解できません。</p>; }
  const names = ['Header', 'Payload', 'Signature'];
  return <section className="jwt-parts" aria-label="JWTを3つに分解">
    <p className="jwt-unverified">デコードした値・未検証：読めただけでは本物と判断できません。</p>
    <div className="jwt-part-tabs" role="group" aria-label="見る部分を選ぶ">{names.map((name, i) => <button key={name} aria-pressed={part === i} onClick={() => setPart(i)}>{name}</button>)}</div>
    <p>{part === 0 ? '署名の方式などの情報。algも送信者が書けるため、許可する方式はサーバー側で決めます。' : part === 1 ? '利用者・発行者・宛先・期限などの情報。トークンを持つ人は秘密鍵なしで読めます。' : 'HeaderとPayloadに対する署名。公開鍵で確かめます。暗号化されたプロフィールではありません。'}</p>
    {part < 2 ? <pre>{JSON.stringify(part === 0 ? decoded.header : decoded.payload, null, 2)}</pre> : <code className="jwt-encoded">{decoded.segments[2] || '空（署名なし）'}</code>}
    {part === 1 && <p className="jwt-time">exp（日本時間）：{typeof decoded.payload.exp === 'number' ? new Date(decoded.payload.exp * 1000).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : 'なし'}</p>}
    <details open={detailed || undefined}><summary>符号化された値と用語を見る</summary><p>HeaderとPayloadはBase64URLで符号化されたJSONです。Signatureは署名のバイト列をBase64URLで表したものです。</p><code className="jwt-encoded">{decoded.segments[part] || '空'}</code><dl>{claims.map(([name, why]) => <div key={name}><dt>{name}</dt><dd>{why}</dd></div>)}</dl><p>iat / expの数値はUnix時刻（秒）。ここで表示するのはAccess Tokenの期限で、Sessionの期限ではありません。</p></details>
  </section>;
}
