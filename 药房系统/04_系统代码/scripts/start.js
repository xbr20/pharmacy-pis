/**
 * 生产启动脚本（跨平台、可自愈）
 * 1) 缺失 Prisma Client → 生成
 * 2) 缺失数据库文件   → 建表 + 灌模拟数据（SQLite 零配置）
 * 3) 缺失构建产物     → next build
 * 4) 启动 next start，监听 $PORT（默认 3000）并绑定 0.0.0.0
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const bin = (name) =>
  path.join(root, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);

function run(cmd, args, label) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`✗ ${label} 失败（退出码 ${r.status}）`);
    process.exit(r.status ?? 1);
  }
}

const dbFile = path.join(root, "prisma", "dev.db");
const clientFile = path.join(root, "node_modules", ".prisma", "client", "index.js");
const buildFile = path.join(root, ".next", "BUILD_ID");

// 每次启动都重新生成 Prisma Client。
// 原因：部署环境会复用上一次的 node_modules，里面缓存的 Client 类型可能停留在旧版 schema，
// 导致 next build 阶段出现「字段不存在于 XXXWhereInput」这类类型错误。
// 生成失败时若已有可用 Client 则降级沿用，不至于让整个启动流程挂掉。
function generateClient() {
  console.log("\n▶ 生成 Prisma Client");
  const r = spawnSync(bin("prisma"), ["generate"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (r.status !== 0) {
    if (!fs.existsSync(clientFile)) {
      console.error(`✗ 生成 Prisma Client 失败（退出码 ${r.status}）`);
      process.exit(r.status ?? 1);
    }
    console.log("! 重新生成 Prisma Client 失败，沿用已有 Client");
  }
}
generateClient();

if (!fs.existsSync(dbFile)) {
  run(bin("prisma"), ["migrate", "deploy"], "初始化数据库（建表）");
  run(process.execPath, [path.join("prisma", "seed.js")], "灌入模拟数据");
} else {
  // 数据库文件存在但没有任何业务数据（dev.db 未随源码上传等场景）→ 自动补灌，
  // 保证线上打开就有数据可看
  const probe = spawnSync(
    process.execPath,
    ["-e",
      "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();" +
      "p.drug.count().then(n=>p.$disconnect().then(()=>process.exit(n>0?0:1)))" +
      ".catch(()=>process.exit(2));"],
    { cwd: root, stdio: "ignore" }
  );
  if (probe.status !== 0) {
    console.log("\n▶ 检测到数据库为空，自动补灌模拟数据");
    run(bin("prisma"), ["migrate", "deploy"], "补建数据表");
    run(process.execPath, [path.join("prisma", "seed.js")], "补灌模拟数据");
  }
}

// 构建产物的「新鲜度」判断：源码比 BUILD_ID 更新（重新部署 / 改过代码）就重建，
// 避免线上一直复用旧构建产物、页面内容与源码不一致
function srcNewerThanBuild() {
  if (!fs.existsSync(buildFile)) return true;
  const bt = fs.statSync(buildFile).mtimeMs;
  let newest = 0;
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) for (const e of fs.readdirSync(p)) walk(path.join(p, e));
    else newest = Math.max(newest, st.mtimeMs);
  };
  for (const s of ["app", "components", "lib", "middleware.ts", "next.config.mjs", "tailwind.config.ts", "tsconfig.json"]) {
    const p = path.join(root, s);
    if (fs.existsSync(p)) walk(p);
  }
  return newest > bt;
}

if (srcNewerThanBuild()) run(bin("next"), ["build"], "构建应用");

const port = process.env.PORT || "3000";
run(bin("next"), ["start", "-H", "0.0.0.0", "-p", String(port)], `启动服务（0.0.0.0:${port}）`);
