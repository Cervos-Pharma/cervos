import { NextResponse } from "next/server";
import {
  WS_ACCOUNT_COOKIE,
  WS_PROFILE_COOKIE,
  WS_TRUSTED_COOKIE,
} from "@/lib/security/session";

const IS_PROD = process.env.NODE_ENV === "production";

export const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

export function noStoreJson<T>(data: T, init?: ResponseInit): NextResponse<T> {
  const headers = new Headers(init?.headers);
  for (const [k, v] of Object.entries(NO_STORE_HEADERS)) {
    headers.set(k, v);
  }
  return NextResponse.json(data, { ...init, headers });
}

export function setHttpCookie(
  res: NextResponse,
  name: string,
  value: string,
  maxAgeSec: number
): void {
  res.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    path: "/",
    maxAge: maxAgeSec,
  });
}

export function setLangCookie(res: NextResponse, lang: "EN" | "SW"): void {
  res.cookies.set("cervos_lang", lang, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
    secure: IS_PROD,
  });
}

export function clearWorkspaceCookies(res: NextResponse, clearTrust = false): void {
  res.cookies.delete(WS_ACCOUNT_COOKIE);
  res.cookies.delete(WS_PROFILE_COOKIE);
  if (clearTrust) {
    res.cookies.delete(WS_TRUSTED_COOKIE);
  }
}
