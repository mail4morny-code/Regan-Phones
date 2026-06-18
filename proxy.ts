import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { supabaseMiddlewareClient } from "./lib/supabase/middleware";

const PUBLIC_FILE = /\.(.*)$/;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_FILE.test(pathname)) return NextResponse.next();

  const supabase = supabaseMiddlewareClient(req);
  if (!supabase) return NextResponse.next();

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");
  const isPasswordResetRoute =
    pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password");

  if (!isAuthRoute && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user && !isPasswordResetRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)", "/"],
};
