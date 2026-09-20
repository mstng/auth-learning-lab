import { NextRequest, NextResponse } from "next/server";
import type { CookieView } from "./types";
export const SESSION_COOKIE = "lab_session";
export const SPACE_COOKIE = "lab_space";
export const secure = () => process.env.COOKIE_SECURE === "true";
export function guard(req: NextRequest): string | undefined {
  if (process.env.LAB_MODE !== "true")
    return "このAPIはLAB_MODE=trueの学習環境専用です。";
  const allowed = process.env.APP_ORIGIN ?? "http://localhost:3000";
  if (req.headers.get("host") !== new URL(allowed).host)
    return "許可されていないHostです。APP_ORIGINを確認してください。";
  if (req.headers.get("x-lab-request") !== "1")
    return "学習画面から操作してください。";
  if (req.headers.get("sec-fetch-site") === "cross-site")
    return "Cross-siteリクエストを拒否しました。";
  if (
    req.method !== "GET" &&
    (req.headers.get("origin") !== allowed ||
      !req.headers.get("content-type")?.startsWith("application/json"))
  )
    return "OriginまたはContent-Typeを検証できません。";
  if (new URL(allowed).protocol === "https:" && !secure())
    return "HTTPS環境ではCOOKIE_SECURE=trueが必要です。";
}
export function cookieString(value: string, expires?: string) {
  return `${SESSION_COOKIE}=${value}; Path=/; ${expires ? `Expires=${new Date(expires).toUTCString()}; ` : ""}HttpOnly; ${secure() ? "Secure; " : ""}SameSite=Lax`;
}
export function cookieView(
  req: NextRequest,
  value: string,
  expires: string | null,
  source: string,
): CookieView {
  return {
    name: SESSION_COOKIE,
    value,
    domain:
      new URL(process.env.APP_ORIGIN ?? req.url).hostname + " (host-only)",
    path: "/",
    httpOnly: true,
    secure: secure(),
    sameSite: "Lax",
    expires,
    source,
  };
}
export function setCookie(
  response: NextResponse,
  name: string,
  value: string,
  expires?: string,
) {
  response.cookies.set(name, value, {
    path: "/",
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    ...(expires ? { expires: new Date(expires) } : {}),
  });
}
export function clearCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    maxAge: 0,
    expires: new Date(0),
  });
}
export function jsonResponse(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
