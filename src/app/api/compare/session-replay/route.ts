import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { guard, jsonResponse, SPACE_COOKIE } from '@/lib/http';
import { findSession, isSessionValid, snapshot, spaceExists } from '@/lib/store';
import type { SessionReplayResult } from '@/lib/compare-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(req: NextRequest) {
  const denied = guard(req);
  if (denied) return jsonResponse({ message: denied }, 403);
  if (req.method !== 'POST') return jsonResponse({ message: 'POSTでコピーしたSession IDを送ってください。' }, 405);
  try {
    const lab = req.cookies.get(SPACE_COOKIE)?.value;
    if (!lab || !await spaceExists(lab)) return jsonResponse({ message: '学習空間を準備してください。' }, 428);
    const raw = await req.text();
    if (raw.length > 1024) return jsonResponse({ message: 'リクエストが大きすぎます。' }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return jsonResponse({ message: 'JSON形式が正しくありません。' }, 400); }
    if (!body || typeof body !== 'object' || !('sessionId' in body) || typeof body.sessionId !== 'string' || !/^[a-f0-9]{64}$/.test(body.sessionId)) {
      return jsonResponse({ message: 'この教材で発行したSession IDを送ってください。' }, 400);
    }
    const sessionId = body.sessionId;
    const before = await snapshot(lab);
    const session = await findSession(lab, sessionId);
    const user = before.users.find(u => u.id === session?.user_id);
    const now = new Date();
    const code: SessionReplayResult['code'] = !session ? 'missing' : !isSessionValid(session, now.getTime()) ? 'expired' : user?.status !== 'active' ? 'inactive' : 'valid';
    const status = code === 'valid' ? 200 : 401;
    const profile = code === 'valid' && user ? { id: user.id, email: user.email, role: user.role } : undefined;
    const after = await snapshot(lab);
    const result: SessionReplayResult = {
      requestId: randomUUID(), sessionId, receivedVia: 'json-body', status, code,
      serverTime: now.toISOString(), profile, before, after,
      http: { method: 'POST', path: '/api/compare/session-replay',
        requestHeaders: { 'X-Lab-Request': '1', 'Content-Type': req.headers.get('content-type')! },
        requestBody: { sessionId }, status, responseHeaders: { 'Cache-Control': 'no-store, private' }, responseBody: { code, ...(profile ? { profile } : {}) } },
      trace: [
        { place: 'server', source: 'server', title: 'コピーしたSession IDを受信', text: 'JSON本文で届いた実際の番号を照合します。', detail: 'ブラウザの認証Cookieは変更しません。Cookie再送を装った内部HTTPも作りません。' },
        { place: 'database', source: 'server', title: session ? 'Sessionの対応表が見つかった' : 'Sessionの対応表が見つからない', text: session ? 'DBの期限と利用者状態を確認します。' : '番号のコピーがあっても、サーバーが対応を覚えていません。', detail: '既存Sessionと同じPGlite / findSession / isSessionValidを使用。lab_idで照会を限定。' },
        { place: 'server', source: 'server', title: `Sessionの再送：HTTP ${status}`, text: code === 'valid' ? '有効なDBの記録に基づいて受理しました。' : `利用を拒否しました。理由：${code === 'missing' ? 'DBの記録なし' : code === 'expired' ? 'DBの期限切れ' : '利用者無効'}。`, detail: 'Cookieがないだけの401とは区別します。送信した番号の全桁と照合理由を記録します。' },
      ],
    };
    const response = jsonResponse(result, status);
    response.headers.set('X-Request-ID', result.requestId);
    return response;
  } catch {
    console.error(JSON.stringify({ event: 'session_replay_failed' }));
    return jsonResponse({ message: 'Sessionの照合・観測に失敗しました。再試行してください。' }, 503);
  }
}
export const POST = handle;
export const GET = handle;
