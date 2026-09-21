import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { guard, jsonResponse, SPACE_COOKIE } from '@/lib/http';
import { findUser, snapshot, spaceExists } from '@/lib/store';
import { hashPassword, validCredentials, verifyPassword } from '@/lib/password';
import { jwtKeys } from '@/lib/jwt-keys';
import { issueJwt, verifyJwt } from '@/lib/jwt';
import { jwtMessages, type JwtResult, type JwtStep, type JwtCode, type JwtClaims } from '@/lib/jwt-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let dummyHash: Promise<string> | undefined;

async function handle(req: NextRequest, ctx: { params: Promise<{ operation: string }> }) {
  const denied = guard(req);
  if (denied) return jsonResponse({ message: denied }, 403);
  const { operation } = await ctx.params;
  const method = operation === 'issue' ? 'POST' : operation === 'profile' ? 'GET' : null;
  if (!method) return jsonResponse({ message: 'APIが見つかりません。' }, 404);
  if (req.method !== method) return jsonResponse({ message: 'このHTTPメソッドは使用できません。' }, 405);
  try {
    const lab = req.cookies.get(SPACE_COOKIE)?.value;
    if (!lab || !await spaceExists(lab)) return jsonResponse({ message: '学習空間を初期化してください。画面を再読み込みすると再開できます。' }, 428);
    const trace: JwtStep[] = [];
    const add = (place: JwtStep['place'], title: string, why: string, detail: string) => trace.push({ id: randomUUID(), at: new Date().toISOString(), place, title, why, detail, evidence: 'server' });
    const before = await snapshot(lab);
    const keys = await jwtKeys();
    let code: JwtCode = 'valid', token: string | undefined, claims: JwtClaims | undefined;
    let requestBody: unknown;
    const authorization = req.headers.get('authorization');
    add('server', operation === 'issue' ? '発行のリクエストを受信' : 'APIへのリクエストを受信', '発行と、その後のアクセスは別のHTTP通信です。', `${req.method} /api/jwt/${operation}`);
    if (operation === 'issue') {
      const raw = await req.text();
      if (raw.length > 4096) return jsonResponse({ message: 'リクエストが大きすぎます。' }, 413);
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return jsonResponse({ message: 'JSON形式が正しくありません。' }, 400); }
      if (!validCredentials(body)) return jsonResponse({ message: 'メールアドレス・パスワード・有効期限を確認してください。' }, 400);
      const user = await findUser(lab, body.email);
      add('database', '利用者の記録を検索', '発行時の本人確認にはユーザーDBを使います。', 'usersを学習空間とemailで照会（実SQL / PGlite）。');
      dummyHash ??= hashPassword('not-a-demo-password');
      const matched = await verifyPassword(body.password, user?.password_hash ?? await dummyHash);
      requestBody = { email: body.email, password: '[REDACTED]', ttl: body.ttl ?? 300 };
      add('server', matched && user?.status === 'active' ? 'パスワードの照合に成功' : '本人確認を拒否', '確認できた利用者にだけJWTを発行します。', 'bcrypt.compareを実行。平文パスワードは記録しません。');
      if (!matched || !user || user.status !== 'active') code = 'credentials';
      else {
        token = await issueJwt(user, lab, (body.ttl ?? 300) as 15 | 300, keys.privateKey, keys.kid);
        add('server', '秘密鍵でJWTに署名', '発行者が作った内容から変わっていないか、後で公開鍵で確かめるためです。', 'jose.SignJWT / RS256。HeaderとPayloadを署名対象にし、JWTごとのDB行は作りません。');
      }
    } else {
      const match = authorization?.match(/^Bearer ([^\s]+)$/i);
      const verdict = authorization && !match ? { code: 'malformed' as const } : await verifyJwt(match?.[1] ?? null, lab, keys.publicKey);
      code = verdict.code;
      claims = 'claims' in verdict ? verdict.claims : undefined;
      add('server', code === 'valid' ? '公開鍵と利用条件で検証に成功' : '検証で利用を拒否', jwtMessages[code],
        `jose.jwtVerify: algorithms=[RS256] / iss / aud / exp / typ / 必須claims / 学習空間。結果=${code}${'libraryCode' in verdict && verdict.libraryCode ? ` (${verdict.libraryCode})` : ''}。利用者の最新情報は再照会しません。`);
      if (claims) add('server', '検証済みの利用者情報を返す', '検証に通った内容だけをAPIの判断に使います。', 'sub / email / roleはJWT発行時の値です。ID TokenやOIDCログインではありません。');
    }
    const after = await snapshot(lab);
    add('database', '観察用にDBの前後を取得', 'JWT発行・利用でSessionの記録が増えたかを実データで見ます。', '学習空間の存在確認と観察用SQLは実行しています。JWTを受理するかどうかのSession照会ではありません。');
    const status = code === 'valid' ? 200 : 401;
    const result: JwtResult = {
      requestId: randomUUID(), status, code, message: operation === 'issue' && code === 'valid' ? '本人確認してJWTを発行しました。APIでの検証は次の操作です。' : jwtMessages[code], token, claims,
      publicKey: keys.publicJwk, keyId: keys.kid, serverTime: new Date().toISOString(), before, after, trace,
      http: { method: req.method, path: `/api/jwt/${operation}`,
        requestHeaders: { 'X-Lab-Request': '1', ...(authorization ? { Authorization: authorization } : {}) },
        requestBody, status, responseHeaders: { 'Cache-Control': 'no-store, private' },
        responseBody: { code, ...(token ? { token } : {}), ...(claims ? { claims } : {}) },
      },
    };
    const response = jsonResponse(result, status);
    response.headers.set('X-Request-ID', result.requestId);
    response.headers.set('Vary', 'Cookie, Authorization');
    return response;
  } catch {
    console.error(JSON.stringify({ event: 'jwt_lab_request_failed', operation }));
    return jsonResponse({ message: 'JWTの処理・鍵・DBの観察に失敗しました。再試行してください。' }, 503);
  }
}
export const GET = handle;
export const POST = handle;
