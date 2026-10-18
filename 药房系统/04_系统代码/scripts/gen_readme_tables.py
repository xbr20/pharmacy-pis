# -*- coding: utf-8 -*-
"""
把数据库里的真实业务数据渲染成 Markdown 表格，自动填充进 README.md 的标记块之间。

README 中的标记：
    <!-- DATA_OVERVIEW_START --> ... <!-- DATA_OVERVIEW_END -->   概览类（药品/会员/库存/销售）
    <!-- DATA_DETAIL_START  --> ... <!-- DATA_DETAIL_END  -->     明细类（流水/盘点/追溯/积分/处置/处方）

这样 README（GitHub 首页）与数据集 Excel 永远同步，数据变了重跑一次即可。
"""
import os
import re
import sqlite3
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "prisma", "dev.db")
README = os.path.join(ROOT, "README.md")
XLSX_HINT = "`data/药房信息系统_数据集.xlsx`"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from export_dataset_excel import build_views  # noqa: E402  复用视图查询


def ts(v, fmt="%Y-%m-%d %H:%M"):
    if v is None or v == "":
        return "—"
    return v


def md_table(headers, rows, limit=None, note=""):
    """生成 GitHub 风格 Markdown 表格"""
    show = rows[:limit] if limit else rows
    out = ["| " + " | ".join(headers) + " |",
           "|" + "|".join(["---"] * len(headers)) + "|"]
    for r in show:
        cells = []
        for v in r:
            s = "—" if v is None or v == "" else str(v)
            s = s.replace("|", "\\|").replace("\n", " ")
            cells.append(s)
        out.append("| " + " | ".join(cells) + " |")
    tail = []
    if limit and len(rows) > limit:
        tail.append(f"\n> 表中为前 {limit} 条（共 {len(rows)} 条），完整数据见 {XLSX_HINT}。")
    elif note:
        tail.append(f"\n> {note}")
    return "\n".join(out) + ("\n" + "\n".join(tail) if tail else "")


def update_table_list(text, counts):
    """把 2.1 节「22 张表清单」末尾的「行数」列刷新为当前实际记录数"""
    def repl(m):
        tbl = m.group(3)
        if tbl in counts:
            return "| %s | %s| `%s` |%s| %d |" % (m.group(1), m.group(2), tbl, m.group(4), counts[tbl])
        return m.group(0)

    return re.sub(
        r"^\|\s*(\d+)\s*\|\s*([^|]*)\|\s*`(\w+)`\s*\|(.*)\|\s*(\d+)\s*\|$",
        repl, text, flags=re.M)


def main():
    if not os.path.exists(DB):
        print("✗ 找不到数据库：", DB)
        return 1
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    views = {t: (h, r) for t, h, r, _ in build_views(cur)}

    # 全库规模（22 张表 / 全部记录数），用于概览段的说明文字
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tnames = [x[0] for x in cur.fetchall()
              if not x[0].startswith("_") and x[0] != "sqlite_sequence"]
    counts, total_rows = {}, 0
    for t in tnames:
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        n = cur.fetchone()[0]
        counts[t] = n
        total_rows += n
    conn.close()

    today = datetime.now().strftime("%Y-%m-%d")

    # ---------- 概览块 ----------
    ov = []
    ov.append(f"以下表格为 {today} 从运行中的数据库**直接导出**的真实记录（非手工编造），"
              f"用于验证业务规则落地。完整 {len(tnames)} 张表、{total_rows} 条记录已整理为 {XLSX_HINT}。\n")

    h, r = views["02_药品总览"]
    normal = sum(1 for x in r if x[12] == "正常")
    near = sum(1 for x in r if x[12] == "近效期")
    expired = sum(1 for x in r if x[12] == "已过期")
    ov.append(f"### 1. 药品总览（{len(r)} 个品种）\n")
    ov.append(md_table(["药品编码", "药品名称", "规格", "生产厂家", "处方药", "医保",
                        "零售价", "库存合计", "最早效期", "效期状态"],
                       [[x[0], x[1], x[2], x[3], x[4], x[5], f"{x[6]:.2f}", x[9], ts(x[10]), x[12]]
                        for x in r], limit=10,
                       note=f"效期分布：正常 {normal} 个 · 近效期 {near} 个 · 已过效期 {expired} 个。"))

    h, r = views["03_库存与效期"]
    ov.append(f"\n### 2. 库存与效期（{len(r)} 个批次）\n")
    ov.append(md_table(["批号", "药品名称", "规格", "库位", "有效期至", "剩余天数",
                        "效期状态", "库存数量"],
                       [[x[0], x[2], x[3], x[4], ts(x[5]), x[6], x[7], x[8]] for x in r], limit=10))

    h, r = views["04_会员总览"]
    ov.append(f"\n### 3. 会员总览（{len(r)} 位会员）\n")
    ov.append(md_table(["会员卡号", "姓名", "会员等级", "折扣率", "积分倍率", "当前积分",
                        "累计消费", "消费次数", "最近消费"],
                       [[x[0], x[1], x[3], x[4], x[5], x[6], f"{x[7]:.2f}", x[8], ts(x[9])] for x in r],
                       note="会员等级决定折扣率与积分倍率；普通会员无折扣、1 倍积分，金卡 95 折、2 倍积分。"))

    h, r = views["05_销售单汇总"]
    ov.append(f"\n### 4. 销售单汇总（{len(r)} 单）\n")
    ov.append(md_table(["销售单号", "销售时间", "店员", "会员", "支付方式", "应收",
                        "实收", "医保报销", "本次积分", "状态"],
                       [[x[0], ts(x[1]), x[2], x[4], x[6], f"{x[7]:.2f}", f"{x[9]:.2f}", f"{x[10]:.2f}",
                         x[12], x[15]] for x in r], limit=8,
                       note="含当日实时销售；支付方式覆盖现金 / 扫码 / 医保三类。"))

    # ---------- 明细块 ----------
    dt = []

    h, r = views["07_库存变动流水"]
    dt.append(f"### 5. 库存变动流水（{len(r)} 条，改数的唯一入口）\n")
    dt.append(md_table(["发生时间", "批号", "药品名称", "变动类型", "变动数量",
                        "变动前", "变动后", "来源单据", "经手人"],
                       [[ts(x[0]), x[1], x[3], x[5], x[6], x[7], x[8], x[10], x[11]] for x in r],
                       limit=10,
                       note="`变动前 → 变动后` 前后勾稽：每条流水的 `变动前` 等于上一条的 `变动后`，可逐笔审计。"))

    h, r = views["08_盘点与差异"]
    dt.append(f"\n### 6. 盘点与差异（{len(r)} 条明细）\n")
    dt.append(md_table(["盘点单号", "批号", "药品名称", "账面数", "初盘", "复盘",
                        "差异", "差异金额"],
                       [[x[0], x[5], x[6], x[8], x[9], x[10], x[11], f"{x[12]:.2f}"] for x in r],
                       note="差异列出现真实的盘亏（负数）；审批通过后生成「盘点调整」流水回写台账。"))

    h, r = views["09_近效期处置"]
    dt.append(f"\n### 7. 近效期处置（{len(r)} 条）\n")
    dt.append(md_table(["申请单号", "药品名称", "批号", "有效期至", "数量", "处置方式",
                        "状态", "申请人"],
                       [[x[0], x[1], x[3], ts(x[4]), x[5], x[6], x[7], x[8]] for x in r], limit=8,
                       note="状态机：已登记 → 待审批 → 已通过 / 已驳回 / 待重试 → 已撤销。"))

    h, r = views["11_追溯码流向"]
    dt.append(f"\n### 8. 追溯码流向（{len(r)} 条事件）\n")
    dt.append(md_table(["追溯码", "药品名称", "批号", "事件类型", "扫码时间",
                        "操作人", "同步状态"],
                       [[x[0], x[1], x[3], x[5], ts(x[6]), x[7], x[8]] for x in r], limit=8,
                       note="一物一码：入库建档一次，出库 / 退货 / 撤销作为事件追加，含同步状态与重试次数。"))

    h, r = views["10_会员积分流水"]
    dt.append(f"\n### 9. 会员积分流水（{len(r)} 条）\n")
    dt.append(md_table(["发生时间", "会员", "变动类型", "变动积分", "变动后余额",
                        "关联销售单", "备注"],
                       [[ts(x[0]), f"{x[1]} {x[2]}", x[3], x[4], x[5], x[6], x[8]] for x in r],
                       limit=8,
                       note="记账式：销售得分 / 兑换扣分 / 退货回滚，`变动后余额` 逐笔结余。"))

    h, r = views["12_处方登记"]
    dt.append(f"\n### 10. 处方登记（{len(r)} 张）\n")
    dt.append(md_table(["处方编号", "处方日期", "临床诊断", "医师", "处方类型",
                        "自动核验", "状态", "保存到期日"],
                       [[x[0], ts(x[1]), x[4], x[5], x[2], x[7], x[11], ts(x[13])] for x in r],
                       note="处方要素齐全（诊断 / 执业证号 / 医师签名摘要 / 保存期），支持手机端开方。"))

    # ---------- 回填 README ----------
    text = open(README, encoding="utf-8").read()
    blocks = {
        "DATA_OVERVIEW": "\n".join(ov),
        "DATA_DETAIL": "\n".join(dt),
    }
    for key, content in blocks.items():
        pattern = re.compile(
            r"(<!-- " + key + r"_START -->)(.*?)(<!-- " + key + r"_END -->)", re.S)
        if not pattern.search(text):
            print("✗ README 缺少标记：", key)
            return 1
        text = pattern.sub(lambda m: m.group(1) + "\n\n" + content + "\n" + m.group(3), text)

    text = update_table_list(text, counts)

    open(README, "w", encoding="utf-8").write(text)
    print(f"✔ 已回填 README 数据表格：概览 {len(ov)} 段 / 明细 {len(dt)} 段")
    print(f"✔ 已同步表清单行数：{len(counts)} 张表，共 {sum(counts.values())} 条")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
