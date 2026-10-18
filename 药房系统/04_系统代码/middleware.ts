import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PREFIX = ["/login", "/api/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIX.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("pis_session")?.value;
  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"]
};
