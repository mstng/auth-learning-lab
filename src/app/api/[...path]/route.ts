import type { NextRequest } from "next/server";
import { createSpace, spaceExists } from "@/lib/store";
import { execute, getState, type Action } from "@/lib/auth";
import {
  guard,
  jsonResponse,
  setCookie,
  clearCookie,
  SPACE_COOKIE,
  SESSION_COOKIE,
} from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const denied = guard(req);
  if (denied) return jsonResponse({ message: denied }, 403);
  const { path } = await context.params;
  const operation = path.join("/");
  const routes: Record<string, string> = {
    "lab/init": "POST",
    "lab/state": "GET",
    login: "POST",
    password: "POST",
    profile: "GET",
    admin: "GET",
    logout: "POST",
    "lab/expire": "POST",
    "lab/reset": "POST",
  };
  if (!routes[operation])
    return jsonResponse({ message: "APIが見つかりません。" }, 404);
  if (routes[operation] !== req.method)
    return jsonResponse({ message: "このHTTPメソッドは使用できません。" }, 405);
  try {
    let lab = req.cookies.get(SPACE_COOKIE)?.value;
    if (operation === "lab/init") {
      let fresh = false;
      if (!lab || !(await spaceExists(lab))) {
        lab = await createSpace();
        fresh = true;
      }
      const response = jsonResponse({
        state: await getState(req, lab, fresh ? null : undefined),
      });
      setCookie(response, SPACE_COOKIE, lab);
      if (fresh) clearCookie(response);
      return response;
    }
    if (!lab || !(await spaceExists(lab)))
      return jsonResponse(
        { message: "学習空間が未初期化です。画面を再読み込みしてください。" },
        428,
      );
    if (operation === "lab/state")
      return jsonResponse({ state: await getState(req, lab) });
    let body: unknown;
    if (req.method === "POST") {
      const raw = await req.text();
      if (raw.length > 4096)
        return jsonResponse({ message: "リクエストが大きすぎます。" }, 413);
      try {
        body = JSON.parse(raw);
      } catch {
        return jsonResponse({ message: "JSON形式が正しくありません。" }, 400);
      }
    }
    const action = operation.replace("lab/", "") as Action;
    const { result, setSession, clearSession } = await execute(
      req,
      lab,
      action,
      body,
    );
    const response = jsonResponse(result, result.http.status);
    response.headers.set("X-Request-ID", result.requestId);
    if (setSession)
      setCookie(response, SESSION_COOKIE, setSession.value, setSession.expires);
    if (clearSession) clearCookie(response);
    return response;
  } catch {
    console.error(
      JSON.stringify({ event: "lab_request_failed", path: operation }),
    );
    return jsonResponse(
      {
        message:
          "データベース接続または処理に失敗しました。dataフォルダーの書き込み権限と空き容量を確認してください。",
      },
      503,
    );
  }
}
export const GET = handle;
export const POST = handle;
