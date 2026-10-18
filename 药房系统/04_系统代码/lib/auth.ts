import crypto from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SESSION_SECRET ?? "pis-dev-session-secret";
const COOKIE = "pis_session";
const TTL_MS = 8 * 60 * 60 * 1000; // 8 小时

/** 口令散列（SHA-256 + 固定盐；教学演示用，生产应使用 bcrypt/argon2） */
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(`${password}::pis`).digest("hex");
}

export function makeToken(username: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${username}|${exp}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

export function verifyToken(token?: string): { username: string; exp: number } | null {
  if (!token) return null;
  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const [username, expStr, sig] = parts;
  const expect = crypto
    .createHmac("sha256", SECRET)
    .update(`${username}|${expStr}`)
    .digest("hex");
  if (sig !== expect) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return { username, exp };
}

/** 读取当前登录用户；未登录或过期返回 null */
export function currentUser(): { username: string } | null {
  const token = cookies().get(COOKIE)?.value;
  const info = verifyToken(token);
  return info ? { username: info.username } : null;
}

export const SESSION_COOKIE = COOKIE;
