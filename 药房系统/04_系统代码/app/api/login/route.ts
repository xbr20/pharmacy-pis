import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, makeToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  let username = "";
  let password = "";
  try {
    const body = await req.json();
    username = String(body.username ?? "").trim();
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }

  if (!username || !password) {
    return NextResponse.json({ ok: false, message: "请输入账号与口令" }, { status: 400 });
  }

  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user || user.passwordHash !== hashPassword(password)) {
    return NextResponse.json({ ok: false, message: "账号或口令不正确" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, name: user.name });
  res.cookies.set(SESSION_COOKIE, makeToken(user.username), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60
  });
  return res;
}
