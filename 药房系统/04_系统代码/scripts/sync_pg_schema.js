/**
 * 由 prisma/schema.prisma（SQLite 版，唯一事实来源）派生 PostgreSQL 版：
 *   prisma/schema.postgresql.prisma —— 仅 provider 不同，结构完全一致。
 *
 * 背景：两份 schema 曾经各自演进，postgresql 版停留在旧结构（缺 AuditLog /
 * PointLog / RewardItem / StockMovement，且 ExpiryDisposal 缺 status 等字段），
 * 一旦被误用就会导致 Prisma Client 类型缺失、构建期报
 * “'xxx' does not exist in type 'XXXWhereInput'”。本脚本保证二者永不脱节。
 *
 * 用法：node scripts/sync_pg_schema.js
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "prisma", "schema.prisma");
const dst = path.join(root, "prisma", "schema.postgresql.prisma");

const text = fs.readFileSync(src, "utf8");

const header = [
  "// 药房信息系统（PIS）Prisma 数据模型",
  "// 由分析类图映射而来，映射规则见 docs/database-design.md（依据 PPT D-设计 P396–403）",
  "// 本文件为 PostgreSQL 版本：由 prisma/schema.prisma 自动派生（node scripts/sync_pg_schema.js）",
  "// 请勿手工编辑本文件——结构必须与 schema.prisma 完全一致，仅 provider 不同",
  "// 用法：cp prisma/schema.postgresql.prisma prisma/schema.prisma",
  ""
].join("\n");

// 去掉原文件头部的注释行，只保留 generator 之后的内容
const bodyStart = text.indexOf("generator client");
if (bodyStart < 0) {
  console.error("✗ 未找到 generator client 声明，同步中止");
  process.exit(1);
}
let body = text.slice(bodyStart);

if (!/provider\s*=\s*"sqlite"/.test(body)) {
  console.error("✗ 源 schema 的 provider 不是 sqlite，同步中止（请确认 prisma/schema.prisma 未改动）");
  process.exit(1);
}
body = body.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');

fs.writeFileSync(dst, header + "\n" + body, "utf8");

const countModels = (s) => (s.match(/^model\s+\w+/gm) || []).length;
console.log(`✔ 已同步 ${path.relative(root, dst)}：模型 ${countModels(body)} 个，provider = postgresql`);
