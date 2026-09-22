import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { guard, jsonResponse, SPACE_COOKIE } from '@/lib/http';
import { database, findUser, spaceExists } from '@/lib/store';
import { hashPassword, validCredentials, verifyPassword } from '@/lib/password';
import { jwtKeys } from '@/lib/jwt-keys';
import { issueJwt, verifyJwt } from '@/lib/jwt';
import { jwtMessages, type JwtClaims, type JwtStep } from '@/lib/jwt-types';
import { issueTokens, refreshSnapshot, useRefresh } from '@/lib/refresh-store';
import { refreshMessages, type TokensCode, type TokensOperation, type TokensResult, type TokenPair } from '@/lib/tokens-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let dummyHash: Promise<string> | undefined;

async function handle(req: NextRequest, ctx: { params: Promise<{ operation: string }> }) {
  const denied = guard(req);
  if (denied) return jsonResponse({ message: denied }, 403);
  const { operation } = await ctx.params;
  const method = ['state', 'profile'].includes(operation) ? 'GET' : ['issue', 'refresh', 'revoke', 'expire'].includes(operation) ? 'POST' : null;
  if (!method) return jsonResponse({ message: 'APIが見つかりません。' }, 404);
  if (req.method !== method) return jsonResponse({ message: 'このHTTPメソッドは使用できません。' }, 405);
  try {
    const lab = req.cookies.get(SPACE_COOKIE)?.value;
    if (!lab || !await spaceExists(lab)) return jsonResponse({ message: '学習空間を準備してください。' }, 428);
    const db = await database();
    if (operation === 'state') return jsonResponse(await db.transaction(tx => refreshSnapshot(tx, lab)));
    let body: Record<string, unknown> = {};
    if (method === 'POST') {
      const raw = await req.text();
      if (raw.length > 10000) return jsonResponse({ message: 'リクエストが大きすぎます。' }, 413);
      try { body = JSON.parse(raw); } catch { return jsonResponse({ message: 'JSON形式を確認してください。' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonResponse({ message: '入力形式を確認してください。' }, 400);
      if (operation === 'issue' ? !validCredentials(body) : typeof body.refreshToken !== 'string' || body.refreshToken.length > 8192) return jsonResponse({ message: '入力値を確認してください。' }, 400);
    }
    const keys = await jwtKeys();
    const sign = (user: Parameters<typeof issueJwt>[0], ttl: 15 | 300) => issueJwt(user, lab, ttl, keys.privateKey, keys.kid);
    let before = await db.transaction(tx => refreshSnapshot(tx, lab)), after = before;
    let code: TokensCode = 'valid', pair: TokenPair | undefined, claims: JwtClaims | undefined, familyId: string | undefined;
    const trace: JwtStep[] = [];
    const add = (place: JwtStep['place'], title: string, why: string, detail: string) => trace.push({ id: randomUUID(), at: new Date().toISOString(), place, title, why, detail, evidence: 'server' });
    const authorization = req.headers.get('authorization');
    const requestBody = method === 'GET' ? undefined : operation === 'issue'
      ? { email: body.email, password: '[REDACTED]', ttl: body.ttl ?? 15 }
      : { refreshToken: body.refreshToken };
    add('server', 'リクエストを受信', operation === 'profile' ? 'APIを使うための値を受け取りました。' : '発行・更新を扱う窓口に届きました。', `${req.method} /api/tokens/${operation}。Cookieは学習空間の識別用で、Session認証を代用しません。`);
    if (operation === 'issue') {
      const user = await findUser(lab, (body.email as string).trim().toLowerCase());
      dummyHash ??= hashPassword('not-a-demo-password');
      const matched = await verifyPassword(body.password as string, user?.password_hash ?? await dummyHash);
      add('database', '登録済みの利用者を照合', '最初の発行だけ、パスワードで本人確認します。', '実users検索とbcrypt.compare。これは教材専用の開始操作で、OAuthのPassword Grantではありません。');
      if (!user || !matched || user.status !== 'active') code = 'credentials';
      else {
        ({ before, after, code, pair, familyId } = await issueTokens(db, lab, user, (body.ttl ?? 15) as 15 | 300, sign));
        if (pair) {
          add('server', '2種類のトークンを発行', 'APIに見せるAccess Tokenと、更新の窓口に見せるRefresh Tokenを分けました。', 'Access: jose / RS256 / iss・aud・exp。Refresh: node:cryptoの256bit乱数。RefreshがJWTである必要はありません。');
          add('database', '更新用のハッシュを保存', '更新時の照合と、古い値の再利用を見分ける記録です。', 'SHA-256・系列ID・世代・期限を実PGliteへ保存。Refresh平文もAccess TokenもDBへ保存しません。');
        } else add('server', '発行を拒否', '利用者の状態を確認できず発行しませんでした。', `結果=${code}`);
      }
    } else if (operation === 'profile') {
      const match = authorization?.match(/^Bearer ([^\s]+)$/i);
      const verdict = authorization && !match ? { code: 'malformed' as const } : await verifyJwt(match?.[1] ?? null, lab, keys.publicKey);
      code = verdict.code; claims = 'claims' in verdict ? verdict.claims : undefined;
      add('server', code === 'valid' ? 'Access Tokenを受理' : 'APIへのアクセスを拒否', jwtMessages[code], 'jose.jwtVerifyでRS256・iss・aud・exp・typ・必須claims・学習空間を検証。Refreshの系列や利用者の現在状態は、アクセス可否の判断には参照しません。');
      after = await db.transaction(tx => refreshSnapshot(tx, lab));
      add('database', '更新用の記録を観察', '操作前後のDBを取得しました。アクセス可否とは別の教材用観察です。', 'RefreshのDBを観察するSQLが動くため、アプリ全体がDBにアクセスしないという意味ではありません。');
    } else {
      ({ before, after, code, pair, familyId } = await useRefresh(db, lab, body.refreshToken as string, operation as 'refresh' | 'revoke' | 'expire', sign));
      add('database', '更新用の値をハッシュで照合', 'どの系列・どの世代の値か、使用済みか、停止済みか、期限内かを確かめました。', '実PGliteのトランザクション内で照合・状態変更・新規発行。更新時は現在のusers.statusも確認します。');
      add('server', code === 'valid' ? '新しい2種類を返す' : code === 'reused' ? '再利用を検知' : '処理結果を返す',
        code === 'valid' ? '古いRefresh Tokenは使用済みになり、新しいAccess / Refresh Tokenへ入れ替わりました。' : refreshMessages[code] ?? '更新を拒否しました。',
        code === 'valid' ? 'Accessは5分。Refreshの期限は最初の発行から30分のまま延長しません。新しい署名を作れない場合はDB変更もロールバックします。'
          : code === 'reused' ? '正規利用者と第三者のどちらが再送したかは特定できません。通信の再試行でも起こり得ます。系列全体を停止しますが、発行済みAccess JWTの署名やexpは変わりません。'
          : '更新用の系列の停止・期限と、発行済みAccess Tokenのexpは別の状態です。');
    }
    const status = ['valid', 'revoked_now', 'expired_now'].includes(code) ? 200 : 401;
    const message = code === 'valid' && pair ? '2種類のトークンを受け取りました。Profileの取得は別の操作です。' : refreshMessages[code] ?? jwtMessages[code as keyof typeof jwtMessages];
    const result: TokensResult = {
      requestId: randomUUID(), operation: operation as TokensOperation, status, code, message, pair, claims, familyId,
      before, after, trace, serverTime: new Date().toISOString(),
      http: { method: req.method, path: `/api/tokens/${operation}`, requestHeaders: { 'X-Lab-Request': '1', ...(authorization ? { Authorization: authorization } : {}), ...(requestBody ? { 'Content-Type': 'application/json' } : {}) },
        requestBody, status, responseHeaders: { 'Cache-Control': 'no-store, private' }, responseBody: { code, pair, claims, familyId } },
    };
    const response = jsonResponse(result, status);
    response.headers.set('Vary', 'Cookie, Authorization');
    response.headers.set('X-Request-ID', result.requestId);
    return response;
  } catch {
    console.error(JSON.stringify({ event: 'tokens_lab_request_failed', operation }));
    return jsonResponse({ message: '通信結果を確定できません。更新済みの場合もあるため、自動では再送しません。発行からやり直してください。' }, 503);
  }
}
export const GET = handle;
export const POST = handle;
