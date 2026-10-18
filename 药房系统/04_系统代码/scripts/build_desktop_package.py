# -*- coding: utf-8 -*-
"""
把 pharmacy-pis 项目按「交付类别」重排，打包到桌面：药房作业上传包/

分类：
  01 报告（A-D）.docx
  02 数据集 Excel（14 个业务视图 + 22 张原始表，打开即见数据）
  03 数据库（ER 结构图 / 建表脚本 / 迁移 / seed / dev.db）
  04 系统代码（可运行完整项目）

说明：交付以「可核验的数据」为准，不再附带界面截图与数据表截图——
药品、会员、销售、库存等数据全部整理进 02 数据集 Excel。
说明性文件只保留根目录一份 README.md：报告里已经写透的内容（建模过程、21 张表定义）
不在别处重复，避免冗余讲解文档。
"""
import os
import shutil
from datetime import datetime

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESKTOP = os.path.join(os.path.expanduser("~"), "Desktop")
PKG = os.path.join(DESKTOP, "药房作业上传包")

# (源相对路径, 目标相对路径) —— 目录会整体复制
COPY = [
    ("docs/药房信息系统-系统分析与设计（A-D）.docx", "01_报告/药房信息系统-系统分析与设计（A-D）.docx"),

    ("data/药房信息系统_数据集.xlsx", "02_数据集/药房信息系统_数据集.xlsx"),

    ("diagrams/database-schema.png", "03_数据库/数据库结构图.png"),
    ("sql/schema.sql", "03_数据库/建表脚本_schema.sql"),
    ("prisma/schema.prisma", "03_数据库/schema.prisma"),
    ("prisma/schema.postgresql.prisma", "03_数据库/schema.postgresql.prisma"),
    ("prisma/migrations", "03_数据库/迁移脚本_migrations"),
    ("prisma/seed.js", "03_数据库/模拟数据脚本_seed.js"),
    ("prisma/dev.db", "03_数据库/数据库文件_dev.db"),

    ("app", "04_系统代码/app"),
    ("components", "04_系统代码/components"),
    ("lib", "04_系统代码/lib"),
    ("scripts", "04_系统代码/scripts"),
    ("prisma/schema.prisma", "04_系统代码/prisma/schema.prisma"),
    ("prisma/schema.postgresql.prisma", "04_系统代码/prisma/schema.postgresql.prisma"),
    ("prisma/migrations", "04_系统代码/prisma/migrations"),
    ("prisma/seed.js", "04_系统代码/prisma/seed.js"),
    ("package.json", "04_系统代码/package.json"),
    ("next.config.mjs", "04_系统代码/next.config.mjs"),
    ("tsconfig.json", "04_系统代码/tsconfig.json"),
    ("tailwind.config.ts", "04_系统代码/tailwind.config.ts"),
    ("postcss.config.mjs", "04_系统代码/postcss.config.mjs"),
    ("middleware.ts", "04_系统代码/middleware.ts"),
    ("next-env.d.ts", "04_系统代码/next-env.d.ts"),

    ("README.md", "README.md"),
]

EXTS_SKIP = (".tsbuildinfo",)
# cloud/ 与 lib/cloud.ts 只是线上部署用的占位（重定向），不进交付包
FILES_SKIP = ("cloud.ts",)
DIRS_SKIP = {".next", ".git", "node_modules", ".verify", "backup", "__pycache__",
             "data", ".placeholders", "cloud"}


def copy(src_rel, dst_rel):
    s = os.path.join(SRC, src_rel)
    d = os.path.join(PKG, dst_rel)
    if not os.path.exists(s):
        print("  ! 缺失：", src_rel)
        return 0
    os.makedirs(os.path.dirname(d), exist_ok=True)
    if os.path.isdir(s):
        # 先删掉包里的旧副本再复制。copytree 的 dirs_exist_ok 只覆盖同名文件，
        # 源码里删掉的模块（如已移除的 cloud/）会作为残留留在包内。
        if os.path.isdir(d):
            shutil.rmtree(d)
        shutil.copytree(s, d, ignore=shutil.ignore_patterns(*DIRS_SKIP, *EXTS_SKIP, *FILES_SKIP))
        n = sum(len(f) for _, _, f in os.walk(d))
        print(f"  ✔ 目录 {src_rel:<45} → {dst_rel}  （{n} 文件）")
        return n
    shutil.copy2(s, d)
    print(f"  ✔ 文件 {src_rel:<45} → {dst_rel}")
    return 1


def clean_package():
    """清掉上一轮遗留的旧编号目录。

    脚本是「只覆盖、不删除」的，一旦分类编号调整（例如去掉「03_网页」并把
    数据库/系统代码前移），旧目录就会和新目录并存，出现两个「系统代码」。
    这里按当前 COPY 推导出顶层白名单，把不在白名单里的旧条目删掉。
    """
    if not os.path.isdir(PKG):
        return
    keep_dirs = {d.split("/")[0] for _, d in COPY if "/" in d}
    keep_files = {d for _, d in COPY if "/" not in d} | {"README.md", ".gitignore",
                                                         "在线演示地址.txt"}
    for name in sorted(os.listdir(PKG)):
        path = os.path.join(PKG, name)
        if os.path.isdir(path) and name not in keep_dirs:
            shutil.rmtree(path)
            print("  ✗ 清理旧目录：", name)
        elif os.path.isfile(path) and name not in keep_files:
            os.remove(path)
            print("  ✗ 清理旧文件：", name)


def main():
    os.makedirs(PKG, exist_ok=True)

    print("打包到：", PKG)
    clean_package()
    total = 0
    for s, d in COPY:
        total += copy(s, d)

    # 演示地址说明（放根目录，不再单列「03_网页」目录）
    txt = os.path.join(PKG, "在线演示地址.txt")
    with open(txt, "w", encoding="utf-8") as f:
        f.write("药房信息系统（PIS）在线演示\n\n")
        f.write("地址：https://pharmacy-pis.app.workbuddy.host/\n")
        f.write("账号：admin\n口令：admin123\n\n")
        f.write("说明：全部为模拟数据，不含任何真实患者／顾客信息。\n")
        f.write("生成时间：" + datetime.now().strftime("%Y-%m-%d %H:%M") + "\n")
    total += 1

    size = sum(os.path.getsize(os.path.join(r, f))
               for r, _, fs in os.walk(PKG) for f in fs) / 1024 / 1024
    print(f"\n✔ 打包完成：{total} 个文件，{size:.1f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
