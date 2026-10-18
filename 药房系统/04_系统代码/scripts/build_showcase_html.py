# -*- coding: utf-8 -*-
"""
把 README.md 渲染成「双击即可打开」的离线展示页（单文件 HTML，图片以 base64 内嵌）。

页面呈现方式：正文用 Markdown 渲染（README 中的数据表格已由 gen_readme_tables.py 回填），
末尾自动追加「附录：完整业务数据」——把 12 个业务视图的全部记录渲染成可滚动表格，
替代原先的界面截图与数据表截图，做到「数据全在页面上、可查可核」。

产出：docs/系统展示页.html
用法：python scripts/build_showcase_html.py
"""
import base64
import os
import re
import sqlite3
import sys
from datetime import datetime
from html import escape

import markdown

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
README = os.path.join(ROOT, "README.md")
DB = os.path.join(ROOT, "prisma", "dev.db")
OUT = os.path.join(ROOT, "docs", "系统展示页.html")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

CSS = """
:root { --fg:#24292f; --muted:#57606a; --line:#d0d7de; --bg:#ffffff; --soft:#f6f8fa; --brand:#0969da; }
* { box-sizing: border-box; }
body { margin:0; background:var(--soft); color:var(--fg);
  font-family:-apple-system,"Segoe UI","Microsoft YaHei","PingFang SC",Helvetica,Arial,sans-serif;
  font-size:15px; line-height:1.75; }
.wrap { max-width: 960px; margin:0 auto; background:var(--bg); padding: 48px 56px 72px;
  box-shadow:0 1px 3px rgba(0,0,0,.08); }
h1 { font-size:28px; border-bottom:1px solid var(--line); padding-bottom:12px; margin-top:0; }
h2 { font-size:22px; border-bottom:1px solid var(--line); padding-bottom:8px; margin-top:44px; }
h3 { font-size:17px; margin-top:28px; }
p, li { color:var(--fg); }
a { color:var(--brand); text-decoration:none; } a:hover { text-decoration:underline; }
table { border-collapse:collapse; width:100%; margin:16px 0; font-size:14px; display:block; overflow-x:auto; }
th, td { border:1px solid var(--line); padding:8px 12px; text-align:left; vertical-align:top; }
th { background:var(--soft); font-weight:600; }
tr:nth-child(even) td { background:#fbfcfd; }
code { background:var(--soft); padding:2px 6px; border-radius:4px; font-size:13px;
  font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace; }
pre { background:var(--soft); padding:14px 16px; border-radius:6px; overflow-x:auto; }
pre code { background:none; padding:0; }
blockquote { margin:16px 0; padding:8px 16px; border-left:4px solid var(--line);
  background:var(--soft); color:var(--muted); }
img { max-width:100%; border:1px solid var(--line); border-radius:6px; margin:8px 0; }
hr { border:none; border-top:1px solid var(--line); margin:32px 0; }
/* 完整数据表格：可横向滚动、纵向限高，表头吸顶 */
.dt-wrap { max-height: 460px; overflow: auto; border:1px solid var(--line); border-radius:6px; margin:12px 0 24px; }
.dt-wrap table { margin:0; display:table; border-collapse:collapse; font-size:13px; }
.dt-wrap th { position:sticky; top:0; z-index:1; background:#1F4E79; color:#fff; white-space:nowrap; }
.dt-wrap td { white-space:nowrap; }
.dt-cap { font-size:13px; color:var(--muted); margin:18px 0 6px; font-weight:600; }
.dt-cap span { font-weight:400; }
.badge { display:inline-block; background:#ddf4ff; color:var(--brand); border-radius:999px;
  padding:2px 10px; font-size:12px; margin-right:8px; }
.meta { color:var(--muted); font-size:13px; margin-bottom:24px; }
@media print { body{background:#fff} .wrap{box-shadow:none;padding:0} }
"""


def embed_images(md_text):
    """把 Markdown 里的本地图片路径替换为 base64 data URI"""

    def repl(m):
        alt, src = m.group(1), m.group(2)
        if src.startswith(("http://", "https://", "data:")):
            return m.group(0)
        path = os.path.join(ROOT, src.replace("/", os.sep))
        if not os.path.exists(path):
            print("  ! 图片缺失：", src)
            return m.group(0)
        ext = os.path.splitext(path)[1].lower().lstrip(".")
        mime = "image/png" if ext == "png" else f"image/{ext}"
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        return f"![{alt}](data:{mime};base64,{b64})"

    return re.sub(r"!\[([^\]]*)\]\(([^)\s]+)", repl, md_text)


def build_data_appendix():
    """把 12 个业务视图的完整记录渲染成 HTML 表格（替代截图）"""
    if not os.path.exists(DB):
        print("  ! 找不到数据库，跳过数据附录：", DB)
        return ""
    from export_dataset_excel import build_views

    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    views = build_views(cur)
    conn.close()

    total = sum(len(r) for _, _, r, _ in views)
    parts = [f'<hr><h2 id="appendix">附录：完整业务数据</h2>',
             f'<p>以下 {len(views)} 张表为系统运行后从数据库<strong>直接导出</strong>的全量记录，'
             f'共 {total} 行，已按业务口径完成关联与换算（外键已翻译为中文名称、'
             f'时间戳已转为日期、0/1 已转为「是/否」）。'
             f'同一份数据另存为 <code>data/药房信息系统_数据集.xlsx</code>（36 个 Sheet，含数据字典）。</p>']

    notes = {
        "02_药品总览": "按药品聚合：在库批次数、库存合计、最早效期与效期状态。",
        "03_库存与效期": "一物一批：剩余天数≤90 为近效期，&lt;0 为已过效期。",
        "04_会员总览": "等级决定折扣率与积分倍率；累计消费由销售单聚合（不含已退单）。",
        "05_销售单汇总": "一单一行；支付方式覆盖现金 / 扫码 / 医保，含当日实时销售。",
        "06_销售商品明细": "一行一个商品行，赠品行标记「是否赠品」。",
        "07_库存变动流水": "任何库存变更的唯一入口，「变动前→变动后」前后勾稽可逐笔审计。",
        "08_盘点与差异": "账面 vs 初盘 vs 复盘，差异为负数即盘亏，审批后回写台账。",
        "09_近效期处置": "状态机：已登记 → 待审批 → 已通过 / 已驳回 / 待重试 → 已撤销。",
        "10_会员积分流水": "记账式：销售得分 / 兑换扣分 / 退货回滚，变动后余额逐笔结余。",
        "11_追溯码流向": "一物一码：入库建档一次，出库 / 退货 / 撤销作为事件追加。",
        "12_处方登记": "处方要素齐全，支持手机端开方与自动核验。",
        "13_店员与排班": "店员档案 + 班次安排，执业药师证号与有效期可核查。",
    }

    for title, headers, rows, _ in views:
        name = title.split("_", 1)[1]
        parts.append(f'<div class="dt-cap">{escape(name)}'
                     f'<span> — 共 {len(rows)} 行 · {notes.get(title, "")}</span></div>')
        parts.append('<div class="dt-wrap"><table><thead><tr>')
        parts.append("".join(f"<th>{escape(str(h))}</th>" for h in headers))
        parts.append("</tr></thead><tbody>")
        for r in rows:
            cells = []
            for v in r:
                s = "" if v is None else str(v)
                cells.append(f"<td>{escape(s)}</td>")
            parts.append("<tr>" + "".join(cells) + "</tr>")
        parts.append("</tbody></table></div>")
    return "\n".join(parts)


def main():
    if not os.path.exists(README):
        print("✗ 找不到 README.md")
        return 1
    md_text = open(README, encoding="utf-8").read()
    md_text = embed_images(md_text)

    body = markdown.markdown(md_text, extensions=["tables", "fenced_code", "toc", "attr_list"])
    body += build_data_appendix()
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>药房信息系统（PIS）— 项目展示</title>
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="meta">
    <span class="badge">课程作业</span>
    <span class="badge">系统分析与设计</span>
    本页由 README.md 自动生成 · {datetime.now().strftime('%Y-%m-%d %H:%M')} · 单文件，可离线查看
  </div>
{body}
</div>
</body>
</html>
"""
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✔ 已生成：{OUT}（{os.path.getsize(OUT)/1024:.0f} KB）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
