# -*- coding: utf-8 -*-
"""
把 SQLite 业务库（prisma/dev.db）导出为「打开即可用」的 Excel 数据集。

产出：data/药房信息系统_数据集.xlsx
  ├─ 02_~15_ 业务视图（排在最前，打开即见数据）
  ├─ 22 张业务原始表（按中文表名排序）
  ├─ 00_数据集说明   项目信息 + 全部表清单（中文表名 / 英文表名 / 记录数 / 字段数）
  └─ 01_数据字典     每张表每个字段：中文列名 / 英文列名 / 类型 / 约束 / 说明
  └─ 各业务表        一表一 Sheet，中文表头 + 冻结首行 + 自动筛选 + 列宽自适应

字段中文名来源：
  1) 页面表格列定义 { key: "xxx", label: "中文" }（自动抽取，出现次数多者胜出）
  2) 内置补充字典（id / 外键 / 通用字段等页面未列出来的）
"""
import os
import re
import sqlite3
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "prisma", "dev.db")
SCHEMA = os.path.join(ROOT, "prisma", "schema.prisma")
OUT_DIR = os.path.join(ROOT, "data")
OUT = os.path.join(OUT_DIR, "药房信息系统_数据集.xlsx")

# ---------- 样式 ----------
HEAD_FILL = PatternFill("solid", fgColor="1F4E79")
HEAD_FONT = Font(color="FFFFFF", bold=True, size=11)
TITLE_FONT = Font(bold=True, size=13, color="1F4E79")
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

# 内置字段中文补充字典（页面列定义未覆盖时兜底）
FIELD_CN_FALLBACK = {
    "id": "编号",
    "drugId": "药品编号", "drug_id": "药品编号",
    "batchId": "批次编号", "batch_id": "批次编号",
    "staffId": "店员编号", "staff_id": "店员编号",
    "memberId": "会员编号", "member_id": "会员编号",
    "levelId": "会员等级编号", "level_id": "会员等级编号",
    "locationId": "库位编号", "location_id": "库位编号",
    "traceCodeId": "追溯码编号", "trace_code_id": "追溯码编号",
    "saleOrderId": "销售单编号", "sale_order_id": "销售单编号",
    "prescriptionId": "处方编号", "prescription_id": "处方编号",
    "stocktakeId": "盘点单编号", "stocktake_id": "盘点单编号",
    "ruleId": "规则编号", "rule_id": "规则编号",
    "batchNo": "批号", "batch_no": "批号",
    "drugCode": "药品编码", "drug_code": "药品编码",
    "employeeNo": "员工编号", "employee_no": "员工编号",
    "cardNo": "会员卡号", "card_no": "会员卡号",
    "locationCode": "库位编码", "location_code": "库位编码",
    "orderNo": "销售单号", "order_no": "销售单号",
    "rxNo": "处方编号", "rx_no": "处方编号",
    "takeNo": "盘点单号", "take_no": "盘点单号",
    "ruleNo": "规则编号", "rule_no": "规则编号",
    "applyNo": "申请单号", "apply_no": "申请单号",
    "traceCode": "追溯码", "code": "追溯码", "code_value": "追溯码",
    "stockQty": "库存数量", "stock_qty": "库存数量",
    "expireDate": "有效期至", "expire_date": "有效期至",
    "producedDate": "生产日期", "produced_date": "生产日期",
    "soldAt": "销售时间", "sold_at": "销售时间",
    "disposedAt": "处置时间", "disposed_at": "处置时间",
    "occurredAt": "发生时间", "occurred_at": "发生时间",
    "scannedAt": "扫码时间", "scanned_at": "扫码时间",
    "baseTime": "基准时点", "base_time": "基准时点",
    "createdAt": "创建时间", "created_at": "创建时间",
    "approvedAt": "审批时间", "approved_at": "审批时间",
    "finishedAt": "完成时间", "finished_at": "完成时间",
    "revokedAt": "撤销时间", "revoked_at": "撤销时间",
    "movementType": "变动类型", "movement_type": "变动类型",
    "changeType": "变动类型", "change_type": "变动类型",
    "flowStatus": "流向状态", "flow_status": "流向状态",
    "batchStatus": "批次状态", "batch_status": "批次状态",
    "qtyBefore": "变动前库存", "qty_before": "变动前库存",
    "qtyAfter": "变动后库存", "qty_after": "变动后库存",
    "bookQty": "账面数量", "book_qty": "账面数量",
    "countedQty": "初盘数量", "counted_qty": "初盘数量",
    "actualQty": "复盘数量", "actual_qty": "复盘数量",
    "diffQty": "差异数量", "diff_qty": "差异数量",
    "diffAmount": "差异金额", "diff_amount": "差异金额",
    "costPrice": "成本价", "cost_price": "成本价",
    "salePrice": "销售价", "sale_price": "销售价",
    "memberPrice": "会员价", "member_price": "会员价",
    "receivable": "应收金额", "received": "实收金额",
    "discountAmount": "优惠金额", "discount_amount": "优惠金额",
    "insuranceAmount": "医保报销金额", "insurance_amount": "医保报销金额",
    "insuranceNo": "医保结算号", "insurance_no": "医保结算号",
    "selfPayAmount": "自付金额", "self_pay_amount": "自付金额",
    "pointsEarned": "本次积分", "points_earned": "本次积分",
    "pointsRedeemed": "兑换扣减积分", "points_redeemed": "兑换扣减积分",
    "isMemberPrice": "是否会员价", "is_member_price": "是否会员价",
    "isGift": "是否赠品", "is_gift": "是否赠品",
    "isPrescription": "是否处方药", "is_prescription": "是否处方药",
    "pendingEntry": "是否待录入", "pending_entry": "是否待录入",
    "deviationNote": "偏差说明", "deviation_note": "偏差说明",
    "revokeReason": "撤销原因", "revoke_reason": "撤销原因",
    "takeMode": "盘点方式", "take_mode": "盘点方式",
    "initiatedBy": "发起人", "initiated_by": "发起人",
    "reviewedBy": "复核人", "reviewed_by": "复核人",
    "approvedBy": "审批人", "approved_by": "审批人",
    "operatedBy": "操作人", "operated_by": "操作人",
    "retryCount": "重试次数", "retry_count": "重试次数",
    "lastError": "最近错误", "last_error": "最近错误",
    "balanceAfter": "变动后积分", "balance_after": "变动后积分",
    "discountRate": "折扣率", "discount_rate": "折扣率",
    "pointRate": "积分倍率", "point_rate": "积分倍率",
    "redeemThreshold": "兑换门槛", "redeem_threshold": "兑换门槛",
    "returnOfId": "原销售单（退货）", "return_of_id": "原销售单（退货）",
    "sourceType": "来源类型", "source_type": "来源类型",
    "sourceId": "来源编号", "source_id": "来源编号",
    # —— 页面未列出、手工补齐 ——
    "status": "状态", "remark": "备注", "points": "变动积分",
    "username": "登录账号", "passwordHash": "口令哈希", "role": "角色",
    "targetType": "操作对象类型", "targetId": "操作对象编号", "detail": "操作详情", "ip": "IP 地址",
    "retailPrice": "零售价", "retail_price": "零售价",
    "doctorName": "医师姓名", "doctor_name": "医师姓名",
    "doctorLicence": "医师执业证号", "doctor_licence": "医师执业证号",
    "rxDate": "处方日期", "rx_date": "处方日期", "diagnosis": "临床诊断",
    "rxType": "处方类型", "rx_type": "处方类型", "channel": "来源渠道",
    "autoVerified": "自动核验通过", "auto_verified": "自动核验通过",
    "verifiedAt": "核验时间", "verified_at": "核验时间",
    "reviewerId": "审核药师", "reviewer_id": "审核药师",
    "signHash": "电子签名", "sign_hash": "电子签名",
    "validUntil": "处方有效期至", "valid_until": "处方有效期至",
    "retainedUntil": "保存到期日", "retained_until": "保存到期日",
    "rewardCode": "奖励品编码", "reward_code": "奖励品编码",
    "pointsCost": "所需积分", "points_cost": "所需积分",
    "levelLimitId": "等级限制", "level_limit_id": "等级限制",
    "rewardId": "奖励品", "reward_id": "奖励品",
    "pharmacistExpire": "执业证有效期", "pharmacist_expire": "执业证有效期",
    "scope": "盘点范围", "eventType": "事件类型", "event_type": "事件类型",
    "saleItemId": "销售明细", "sale_item_id": "销售明细",
    "syncStatus": "同步状态", "sync_status": "同步状态",
    "syncedAt": "同步时间", "synced_at": "同步时间",
    "revokesId": "被撤销的记录", "revokes_id": "被撤销的记录",
}

# 需要按「日期」还是「时刻」格式化
DATE_ONLY_COLS = {"expire_date", "produced_date", "work_date", "date", "shift_date",
                  "rx_date", "pharmacist_expire", "valid_until", "retained_until",
                  "birth_date", "hired_date"}


def parse_schema():
    """解析 schema.prisma：模型 → 中文名 / 表名 / 字段（列名、类型、约束）"""
    text = open(SCHEMA, encoding="utf-8").read()
    models = {}
    for m in re.finditer(r"(?:^|\n)(?:///\s*(?P<cmt>[^\n]*)\n)*model\s+(?P<name>\w+)\s*\{(?P<body>.*?)\n\}", text, re.S):
        name = m.group("name")
        body = m.group("body")
        # 注意：必须锚定到 `model <Name> {`，否则 "Member" 会先匹配到 "MemberLevel"
        comment = ""
        cm = re.search(r"///\s*([^\n]+)\nmodel\s+" + name + r"\s*\{", text)
        if cm:
            comment = cm.group(1).strip()
        tbl = re.search(r'@@map\("([^"]+)"\)', body)
        table = tbl.group(1) if tbl else name.lower()
        fields = []
        # 去掉关系字段行（含 @relation 且无标量类型的行）
        for line in body.splitlines():
            line = line.strip()
            if not line or line.startswith("//") or line.startswith("@@") or line.startswith("///"):
                continue
            fm = re.match(r"(\w+)\s+([\w\[\]?]+)\s*(.*)$", line)
            if not fm:
                continue
            fname, ftype, rest = fm.group(1), fm.group(2), fm.group(3)
            if "[" in ftype:            # 列表关系字段
                continue
            if "@relation" in rest and not re.search(r"\b(String|Int|Float|Decimal|Boolean|DateTime|BigInt|Json)\b", ftype):
                continue
            col = re.search(r'@map\("([^"]+)"\)', rest)
            fields.append({
                "name": fname,
                "col": col.group(1) if col else fname,
                "type": ftype.rstrip("?"),
                "optional": ftype.endswith("?"),
                "isId": "@id" in rest,
                "isUnique": "@unique" in rest,
                "hasDefault": "@default" in rest,
            })
        # 表名取注释主干：截掉括号/冒号后的补充说明，并限制长度
        cn = re.split(r"[（(：:]", comment)[0].strip() if comment else ""
        models[name] = {
            "comment": cn[:16] or name,
            "table": table,
            "fields": fields,
        }
    return models


def parse_page_labels():
    """从页面列定义抽取 {字段key: 中文label}（众数胜出）"""
    votes = defaultdict(Counter)
    app_dir = os.path.join(ROOT, "app")
    for dirpath, _, files in os.walk(app_dir):
        for f in files:
            if not f.endswith(".tsx"):
                continue
            text = open(os.path.join(dirpath, f), encoding="utf-8").read()
            for km in re.finditer(r'\{\s*key:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"', text):
                votes[km.group(1)][km.group(2)] += 1
    return {k: c.most_common(1)[0][0] for k, c in votes.items()}


def camel_to_snake(s):
    return re.sub(r"(?<!^)(?=[A-Z])", "_", s).lower()


def safe_sheet_name(s, used):
    s = re.sub(r"[\[\]:*?/\\]", "_", s)[:31]
    base, i = s, 2
    while s in used:
        s = f"{base[:27]}_{i}"
        i += 1
    used.add(s)
    return s


BOOL_COLS = {"is_member_price", "is_gift", "is_prescription", "pending_entry", "is_redeem",
             "auto_verified", "autoVerified",
             # 以下在 SQLite 里存的是 0/1（非 BOOLEAN 亲和），需一并转「是/否」
             "in_medical_insurance", "inMedicalInsurance",
             "verified", "need_approval", "need_approve"}

TIME_COLS = {"sold_at", "disposed_at", "occurred_at", "scanned_at", "base_time",
             "created_at", "approved_at", "finished_at", "revoked_at", "login_at",
             "verified_at", "synced_at"}

# 存的是店员 id，直接导出数字看不懂 —— 统一译成店员姓名
STAFF_COLS = {
    "initiated_by": "发起店员",
    "reviewed_by": "复核店员",
    "reviewer_id": "审核药师",
    "operated_by": "操作人",
    "approved_by": "审批人",
}

# 按表限定的字段名：通用字典会把 drug.name / reward_item.name 都翻成「姓名」
FIELD_CN_BY_TABLE = {
    ("drug", "name"): "药品名称",
    ("reward_item", "name"): "奖励品名称",
    ("member", "name"): "姓名",
    ("staff", "name"): "姓名",
    ("member_level", "level_name"): "等级名称",
    ("storage_location", "name"): "库位名称",
}


# 带 UTC 时区的 epoch：先按 UTC 累加，再转本地，两步都绕开平台限制
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


LOCAL_OFFSET = timedelta(seconds=-time.timezone) if time.timezone else timedelta(hours=8)


def to_local(dt_utc):
    """UTC → 本地时间。Windows 上 1970 年之前的时间戳连 astimezone() 也会失败
    （CRT 的 localtime 不接受负值），此时退回用固定的系统时区偏移。"""
    try:
        return dt_utc.astimezone()
    except Exception:
        return dt_utc.replace(tzinfo=None) + LOCAL_OFFSET


def fmt_value(v, col_name):
    """SQLite 取值 → Excel 单元格：时间戳转日期、0/1 转是否、None 转空"""
    if v is None:
        return ""
    if isinstance(v, bool):
        return "是" if v else "否"
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        # 毫秒时间戳。注意阈值不能设太高：1970 年之前的生日是负数且绝对值较小
        # （如 1968 年 = -63187200000，仅 6.3e10），旧阈值 1e11 会把它们漏掉。
        # 业务字段里最大的普通整数不过几千，用 1e9 判断既安全又能覆盖早期日期。
        if isinstance(v, int) and abs(v) > 10 ** 9 and (col_name in TIME_COLS or col_name in DATE_ONLY_COLS):
            try:
                # 不能用 datetime.fromtimestamp()：Windows 上它对 1970 年之前的负时间戳
                # 直接抛 OSError，会员出生日期这类早期日期会静默退回原始数字。
                dt = to_local(EPOCH + timedelta(seconds=v / 1000))
                return dt.strftime("%Y-%m-%d") if col_name in DATE_ONLY_COLS else dt.strftime("%Y-%m-%d %H:%M")
            except Exception:
                return v
        if col_name in BOOL_COLS:
            return "是" if v else "否"
    return v


def write_sheet(ws, headers, rows, widths=None, freeze="A2"):
    ws.append(headers)
    for c in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=c)
        cell.fill = HEAD_FILL
        cell.font = HEAD_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER
    for r in rows:
        ws.append(r)
    ws.freeze_panes = freeze
    if rows:
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(rows) + 1}"
    for i, h in enumerate(headers, start=1):
        w = widths[i - 1] if widths else max(10, min(28, len(str(h)) * 2 + 4))
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[1].height = 22


def main():
    if not os.path.exists(DB):
        print("✗ 找不到数据库：", DB)
        return 1
    os.makedirs(OUT_DIR, exist_ok=True)

    models = parse_schema()
    labels = parse_page_labels()
    col_to_model = {m["table"]: (name, m) for name, m in models.items()}

    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [r[0] for r in cur.fetchall()
              if not r[0].startswith("_") and r[0] not in ("_prisma_migrations", "sqlite_sequence")]

    wb = Workbook()
    wb.remove(wb.active)          # 去掉默认空 Sheet
    used = set()

    # 店员 id → 姓名（把原始表里的人名外键翻译成可读值）
    cur.execute("SELECT id, name FROM staff")
    staff_map = {r[0]: r[1] for r in cur.fetchall()}

    # ---------- 每张业务表一个 Sheet ----------
    table_stats = []
    dict_rows = []
    for t in tables:
        cur.execute(f'PRAGMA table_info("{t}")')
        cols_info = cur.fetchall()          # (cid, name, type, notnull, dflt, pk)
        col_names = [c[1] for c in cols_info]
        cur.execute(f'SELECT * FROM "{t}"')
        raw = cur.fetchall()

        model_name, model = col_to_model.get(t, (None, None))
        model_fields = {f["col"]: f for f in (model["fields"] if model else [])}
        tbl_cn = model["comment"] if model and model["comment"] else t

        headers, rows = [], []
        for cn in col_names:
            f = model_fields.get(cn)
            fname = f["name"] if f else cn
            # 按表限定 > 内置规范字典 > 页面列定义兜底（页面 label 偏 UI 简称，如"时间"）
            cn_label = (FIELD_CN_BY_TABLE.get((t, cn)) or FIELD_CN_BY_TABLE.get((t, fname))
                        or STAFF_COLS.get(cn)
                        or FIELD_CN_FALLBACK.get(fname) or FIELD_CN_FALLBACK.get(cn)
                        or labels.get(fname) or fname)
            headers.append(cn_label)
            idx = col_names.index(cn)
            vals = []
            for r in raw:
                v = r[idx]
                # 店员外键 → 姓名
                if cn in STAFF_COLS and isinstance(v, int) and v in staff_map:
                    vals.append(staff_map[v])
                else:
                    vals.append(fmt_value(v, cn))
            rows.append(vals)
            # 数据字典
            ftype = f["type"] if f else (cols_info[col_names.index(cn)][2] or "")
            cons = []
            if f:
                if f["isId"]:
                    cons.append("主键")
                if f["isUnique"]:
                    cons.append("唯一")
                if not f["optional"]:
                    cons.append("非空")
                if f["name"].endswith("Id") and not f["isId"]:
                    cons.append("外键")
            elif cols_info[col_names.index(cn)][5]:
                cons.append("主键")
            dict_rows.append([tbl_cn, t, cn_label, cn, ftype, "、".join(cons), ""])

        rows = [list(x) for x in zip(*rows)] if rows else []

        ws = wb.create_sheet(safe_sheet_name(tbl_cn or t, used))
        widths = [max(10, min(30, len(str(h)) * 2 + 4)) for h in headers]
        write_sheet(ws, headers, rows, widths)
        table_stats.append([tbl_cn, t, len(raw), len(col_names)])

    # ---------- 00_数据集说明 ----------
    ws0 = wb.create_sheet("00_数据集说明")
    ws0["A1"] = "药房信息系统（PIS）— 数据集说明"
    ws0["A1"].font = TITLE_FONT
    ws0["A2"] = ("※ 本页只是说明。数据请看底部 Sheet 标签栏：02～15 是已换算好的业务视图（推荐先看），"
                 "后面 22 个是数据库原始表。")
    ws0["A2"].font = Font(bold=True, color="C00000")
    info = [
        ("课程", "系统分析与设计"),
        ("题目", "连锁药房门店「药房信息系统」分析与设计"),
        ("数据来源", "可运行系统 pharmacy-pis 的 SQLite 业务库（prisma/dev.db）实时导出"),
        ("生成脚本", "scripts/export_dataset_excel.py"),
        ("生成时间", datetime.now().strftime("%Y-%m-%d %H:%M")),
        ("数据表数", f"{len(tables)} 张（一表一 Sheet，见下方表清单）"),
        ("总记录数", f"{sum(s[2] for s in table_stats)} 条"),
        ("业务视图", "药品总览 / 库存与效期 / 会员总览 / 销售单汇总 / 销售商品明细 / 库存变动流水 / "
                 "盘点与差异 / 近效期处置 / 会员积分流水 / 追溯码流向 / 处方登记 / 店员与排班 / "
                 "会员购药汇总 / 会员购药明细"
                 "（已关联多表并换算口径，可直接阅读，见下方视图清单）"),
        ("数据性质", "全部为脚本生成的模拟数据；患者／会员姓名为虚构化名，手机号已掩码，不含任何真实个人信息"),
        ("对应章节", "建模文档 4.1「建立数据层」——本数据集即该节 21 张表定义落成后的实际数据"),
    ]
    r = 3
    for k, v in info:
        ws0.cell(row=r, column=1, value=k).font = Font(bold=True)
        ws0.cell(row=r, column=2, value=v)
        r += 1
    ws0.column_dimensions["A"].width = 14
    ws0.column_dimensions["B"].width = 78

    r += 1
    ws0.cell(row=r, column=1, value="表清单（中文表名 / 英文表名 / 记录数 / 字段数）").font = TITLE_FONT
    r += 1
    write_sheet_block(ws0, r, ["中文表名", "英文表名", "记录数", "字段数"], table_stats, [22, 24, 12, 12])
    ws0.freeze_panes = "A3"

    # ---------- 01_数据字典 ----------
    ws1 = wb.create_sheet("01_数据字典")
    write_sheet(ws1, ["所属表（中文）", "英文表名", "字段中文名", "英文字段名", "类型", "约束", "说明"],
                dict_rows, [20, 22, 20, 22, 14, 16, 30])

    # ---------- 02~13 业务视图（宽表，已完成关联与口径换算） ----------
    view_stats = []
    for title, hdr, rows, widths in build_views(cur):
        ws = wb.create_sheet(safe_sheet_name(title, used))
        write_sheet(ws, hdr, rows, widths)
        view_stats.append([title, len(rows), len(hdr)])

    # 说明页补上「业务视图清单」
    r2 = ws0.max_row + 2
    ws0.cell(row=r2, column=1, value="业务视图清单（已关联多表的宽表，可直接阅读）").font = TITLE_FONT
    write_sheet_block(ws0, r2 + 1, ["视图名称", "记录数", "字段数"], view_stats, [22, 12, 12])

    # 排序：业务视图（02_~15_）排到最前 —— 打开文件第一眼就是真实数据；
    # 业务原始表随后按中文名排序；说明页与数据字典（00_/01_）放到最后作附录。
    def indexed(t):
        return bool(re.match(r"^\d{2}_", t))

    def is_info(t):
        return t.startswith("00_") or t.startswith("01_")

    heads = sorted(
        [s for s in wb._sheets if indexed(s.title) and not is_info(s.title)],
        key=lambda s: s.title)
    bodies = sorted([s for s in wb._sheets if not indexed(s.title)], key=lambda s: s.title)
    infos = sorted([s for s in wb._sheets if is_info(s.title)], key=lambda s: s.title)
    wb._sheets = heads + bodies + infos

    wb.save(OUT)
    print(f"✔ 已导出：{OUT}")
    print(f"  业务表 {len(tables)} 张，记录 {sum(s[2] for s in table_stats)} 条")
    print(f"  业务视图 {len(view_stats)} 个：")
    for v in view_stats:
        print(f"    {v[0]:<16} {v[1]:>4} 行 × {v[2]} 列")
    print(f"  Sheet 合计 {len(wb.sheetnames)} 个")
    return 0


# ---------- 业务视图：面向阅读的宽表（已完成关联、换算与口径说明） ----------
def ts(v, fmt="%Y-%m-%d %H:%M"):
    """毫秒时间戳 → 格式化字符串"""
    if v is None:
        return ""
    if isinstance(v, (int, float)) and not isinstance(v, bool) and abs(v) > 10 ** 11:
        try:
            return datetime.fromtimestamp(v / 1000).strftime(fmt)
        except Exception:
            return ""
    return v


def money(v):
    return "" if v is None else round(float(v), 2)


def yn(v):
    if v is None:
        return ""
    return "是" if v else "否"


def expiry_state(expire_ms, today_ms):
    """效期状态：已过期 / 近效期（≤90 天）/ 正常"""
    if expire_ms is None:
        return "", ""
    left = int((expire_ms - today_ms) / 86400000)
    if left < 0:
        return left, "已过期"
    if left <= 90:
        return left, "近效期"
    return left, "正常"


def build_views(cur):
    """返回 [(sheet标题, 中文表头, 数据行, 列宽)]"""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_ms = int(today.timestamp() * 1000)
    views = []

    def q(sql):
        cur.execute(sql)
        return cur.fetchall()

    # ---------- 02 药品总览 ----------
    hdr = ["药品编码", "药品名称", "规格", "生产厂家", "是否处方药", "是否医保",
           "零售价(元)", "成本价(元)", "在库批次数", "库存合计", "最早效期", "剩余天数", "库存状态"]
    rows = []
    for r in q("""
        SELECT d.drug_code, d.name, d.spec, d.manufacturer, d.is_prescription, d.in_medical_insurance,
               d.retail_price, d.cost_price,
               COUNT(b.id) AS bn, COALESCE(SUM(b.stock_qty), 0) AS sq, MIN(b.expire_date) AS ed
        FROM drug d LEFT JOIN drug_batch b ON b.drug_id = d.id
        GROUP BY d.id ORDER BY d.drug_code
    """):
        left, state = expiry_state(r[10], today_ms)
        rows.append([r[0], r[1], r[2], r[3], yn(r[4]), yn(r[5]), money(r[6]), money(r[7]),
                     r[8], r[9], ts(r[10], "%Y-%m-%d"), left,
                     "无库存" if r[9] == 0 else state])
    views.append(("02_药品总览", hdr, rows, [12, 22, 16, 26, 11, 10, 11, 11, 11, 10, 12, 10, 11]))

    # ---------- 03 库存与效期 ----------
    hdr = ["批号", "药品编码", "药品名称", "规格", "存放库位", "有效期至", "剩余天数",
           "效期状态", "库存数量", "批次状态", "流向状态"]
    rows = []
    for r in q("""
        SELECT b.batch_no, d.drug_code, d.name, d.spec, l.location_code, b.expire_date,
               b.stock_qty, b.batch_status, b.flow_status
        FROM drug_batch b
        JOIN drug d ON d.id = b.drug_id
        LEFT JOIN storage_location l ON l.id = b.location_id
        ORDER BY b.expire_date
    """):
        left, state = expiry_state(r[5], today_ms)
        rows.append([r[0], r[1], r[2], r[3], r[4] or "", ts(r[5], "%Y-%m-%d"), left, state,
                     r[6], r[7], r[8]])
    views.append(("03_库存与效期", hdr, rows, [14, 12, 22, 16, 12, 12, 10, 10, 10, 12, 12]))

    # ---------- 04 会员总览 ----------
    hdr = ["会员卡号", "姓名", "手机号", "会员等级", "折扣率", "积分倍率", "当前积分",
           "累计消费金额(元)", "累计消费次数", "最近消费时间", "健康备注"]
    rows = []
    for r in q("""
        SELECT m.card_no, m.name, m.phone, lv.level_name, lv.discount_rate, lv.point_rate,
               m.total_points, m.health_note, m.id,
               (SELECT COALESCE(SUM(received), 0) FROM sale_order s WHERE s.member_id = m.id AND s.status <> '已退'),
               (SELECT COUNT(*) FROM sale_order s WHERE s.member_id = m.id AND s.status <> '已退'),
               (SELECT MAX(sold_at) FROM sale_order s WHERE s.member_id = m.id AND s.status <> '已退')
        FROM member m LEFT JOIN member_level lv ON lv.id = m.level_id
        ORDER BY m.card_no
    """):
        rows.append([r[0], r[1], r[2], r[3] or "", r[4], r[5], r[6], money(r[9]), r[10],
                     ts(r[11]), r[7] or ""])
    views.append(("04_会员总览", hdr, rows, [12, 10, 15, 11, 9, 10, 10, 16, 13, 17, 30]))

    # ---------- 05 销售单汇总 ----------
    hdr = ["销售单号", "销售时间", "店员", "会员卡号", "会员姓名", "处方编号", "支付方式",
           "应收金额(元)", "优惠金额(元)", "实收金额(元)", "医保报销(元)", "自付金额(元)",
           "本次积分", "兑换扣减积分", "商品行数", "单据状态"]
    rows = []
    for r in q("""
        SELECT o.order_no, o.sold_at, st.name, m.card_no, m.name, p.rx_no, o.pay_method,
               o.receivable, o.discount_amount, o.received, o.insurance_amount, o.self_pay_amount,
               o.points_earned, o.points_redeemed, o.status,
               (SELECT COUNT(*) FROM sale_item i WHERE i.sale_order_id = o.id)
        FROM sale_order o
        LEFT JOIN staff st ON st.id = o.staff_id
        LEFT JOIN member m ON m.id = o.member_id
        LEFT JOIN prescription p ON p.id = o.prescription_id
        ORDER BY o.sold_at DESC
    """):
        rows.append([r[0], ts(r[1]), r[2] or "", r[3] or "非会员", r[4] or "", r[5] or "", r[6],
                     money(r[7]), money(r[8]), money(r[9]), money(r[10]), money(r[11]),
                     r[12], r[13], r[15], r[14]])
    views.append(("05_销售单汇总", hdr, rows,
                  [14, 17, 10, 12, 11, 13, 10, 12, 12, 12, 12, 12, 10, 13, 10, 10]))

    # ---------- 06 销售商品明细 ----------
    hdr = ["销售单号", "销售时间", "药品编码", "药品名称", "规格", "批号",
           "数量", "单价(元)", "金额(元)", "是否赠品", "关联奖励品"]
    rows = []
    for r in q("""
        SELECT o.order_no, o.sold_at, d.drug_code, d.name, d.spec, b.batch_no,
               i.quantity, i.unit_price, i.amount, i.is_gift, rw.name
        FROM sale_item i
        JOIN sale_order o ON o.id = i.sale_order_id
        JOIN drug_batch b ON b.id = i.batch_id
        JOIN drug d ON d.id = b.drug_id
        LEFT JOIN reward_item rw ON rw.id = i.reward_id
        ORDER BY o.sold_at DESC, i.id
    """):
        rows.append([r[0], ts(r[1]), r[2], r[3], r[4], r[5], r[6], money(r[7]), money(r[8]),
                     yn(r[9]), r[10] or ""])
    views.append(("06_销售商品明细", hdr, rows,
                  [14, 17, 12, 22, 16, 14, 8, 10, 11, 10, 16]))

    # ---------- 07 库存变动流水 ----------
    hdr = ["发生时间", "批号", "药品编码", "药品名称", "规格", "变动类型", "变动数量",
           "变动前库存", "变动后库存", "变动金额(元)", "来源单据类型", "经手人", "备注"]
    rows = []
    for r in q("""
        SELECT mv.occurred_at, b.batch_no, d.drug_code, d.name, d.spec, mv.movement_type,
               mv.quantity, mv.qty_before, mv.qty_after, mv.amount, mv.source_type, st.name, mv.remark
        FROM stock_movement mv
        JOIN drug_batch b ON b.id = mv.batch_id
        JOIN drug d ON d.id = b.drug_id
        LEFT JOIN staff st ON st.id = mv.staff_id
        ORDER BY mv.occurred_at, mv.id
    """):
        rows.append([ts(r[0]), r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8],
                     money(r[9]), r[10] or "", r[11] or "", r[12] or ""])
    views.append(("07_库存变动流水", hdr, rows,
                  [17, 14, 12, 22, 16, 13, 10, 11, 11, 12, 13, 10, 22]))

    # ---------- 08 盘点与差异 ----------
    hdr = ["盘点单号", "盘点范围", "基准时点", "盘点方式", "单据状态", "批号", "药品名称", "规格",
           "账面数量", "初盘数量", "复盘数量", "差异数量", "差异金额(元)", "是否待录入"]
    rows = []
    for r in q("""
        SELECT t.take_no, t.scope, t.base_time, t.take_mode, t.status, b.batch_no, d.name, d.spec,
               i.book_qty, i.counted_qty, i.actual_qty, i.diff_qty, i.diff_amount, i.pending_entry
        FROM stocktake_item i
        JOIN stocktake t ON t.id = i.stocktake_id
        JOIN drug_batch b ON b.id = i.batch_id
        JOIN drug d ON d.id = b.drug_id
        ORDER BY t.take_no, b.batch_no
    """):
        rows.append([r[0], r[1], ts(r[2]), r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10],
                     r[11], money(r[12]), yn(r[13])])
    views.append(("08_盘点与差异", hdr, rows,
                  [14, 12, 17, 11, 10, 14, 22, 16, 10, 10, 10, 10, 12, 12]))

    # ---------- 09 近效期处置 ----------
    hdr = ["申请单号", "药品名称", "规格", "批号", "有效期至", "处置数量", "处置方式", "单据状态",
           "申请人", "申请时间", "审批人", "审批时间", "重试次数", "偏差说明"]
    rows = []
    for r in q("""
        SELECT e.apply_no, d.name, d.spec, b.batch_no, b.expire_date, e.quantity, e.action,
               e.status, st.name, e.disposed_at, e.approved_by, e.approved_at, e.retry_count,
               e.deviation_note
        FROM expiry_disposal e
        JOIN drug_batch b ON b.id = e.batch_id
        JOIN drug d ON d.id = b.drug_id
        LEFT JOIN staff st ON st.id = e.staff_id
        ORDER BY e.disposed_at DESC
    """):
        rows.append([r[0], r[1], r[2], r[3], ts(r[4], "%Y-%m-%d"), r[5], r[6], r[7],
                     r[8] or "", ts(r[9]), r[10] or "", ts(r[11]), r[12] or 0, r[13] or ""])
    views.append(("09_近效期处置", hdr, rows,
                  [14, 22, 16, 14, 12, 10, 12, 11, 10, 17, 10, 17, 10, 24]))

    # ---------- 10 会员积分流水 ----------
    hdr = ["发生时间", "会员卡号", "会员姓名", "变动类型", "变动积分", "变动后余额",
           "关联销售单", "操作人", "备注"]
    rows = []
    for r in q("""
        SELECT p.occurred_at, m.card_no, m.name, p.change_type, p.points, p.balance_after,
               o.order_no, p.operated_by, p.remark
        FROM point_log p
        JOIN member m ON m.id = p.member_id
        LEFT JOIN sale_order o ON o.id = p.sale_order_id
        ORDER BY p.occurred_at DESC
    """):
        rows.append([ts(r[0]), r[1], r[2], r[3], r[4], r[5], r[6] or "", r[7] or "", r[8] or ""])
    views.append(("10_会员积分流水", hdr, rows, [17, 12, 11, 13, 10, 11, 14, 10, 24]))

    # ---------- 11 追溯码流向 ----------
    hdr = ["追溯码", "药品名称", "规格", "批号", "生产企业", "事件类型", "扫码时间",
           "操作人", "同步状态", "同步时间"]
    rows = []
    for r in q("""
        SELECT c.code, d.name, d.spec, c.batch_no, c.manufacturer, r.event_type, r.scanned_at,
               st.name, r.sync_status, r.synced_at
        FROM trace_record r
        JOIN trace_code c ON c.id = r.trace_code_id
        JOIN drug d ON d.id = c.drug_id
        LEFT JOIN staff st ON st.id = r.staff_id
        ORDER BY r.scanned_at DESC
    """):
        rows.append([r[0], r[1], r[2], r[3], r[4], r[5], ts(r[6]), r[7] or "", r[8], ts(r[9])])
    views.append(("11_追溯码流向", hdr, rows, [26, 22, 16, 14, 26, 13, 17, 10, 11, 17]))

    # ---------- 12 处方登记 ----------
    hdr = ["处方编号", "处方日期", "处方类型", "来源渠道", "临床诊断", "医师姓名", "执业证号",
           "自动核验", "核验时间", "审核药师", "登记人", "处方状态", "有效期至", "保存到期日"]
    rows = []
    for r in q("""
        SELECT p.rx_no, p.rx_date, p.rx_type, p.channel, p.diagnosis, p.doctor_name, p.doctor_licence,
               p.auto_verified, p.verified_at, rv.name, st.name, p.status, p.valid_until, p.retained_until
        FROM prescription p
        LEFT JOIN staff rv ON rv.id = p.reviewer_id
        LEFT JOIN staff st ON st.id = p.staff_id
        ORDER BY p.rx_date DESC
    """):
        rows.append([r[0], ts(r[1], "%Y-%m-%d"), r[2], r[3], r[4], r[5], r[6], yn(r[7]),
                     ts(r[8]), r[9] or "", r[10] or "", r[11], ts(r[12], "%Y-%m-%d"),
                     ts(r[13], "%Y-%m-%d")])
    views.append(("12_处方登记", hdr, rows,
                  [14, 12, 11, 12, 24, 10, 20, 10, 17, 10, 10, 10, 12, 12]))

    # ---------- 13 店员与排班 ----------
    hdr = ["员工编号", "姓名", "岗位", "执业药师证号", "执业证有效期", "入职日期", "本月班次序号", "班次日期", "班次时段"]
    rows = []
    for r in q("""
        SELECT s.employee_no, s.name, s.post, s.pharmacist_no, s.pharmacist_expire, s.hired_date,
               sh.shift_no, sh.work_date, sh.time_range
        FROM staff s LEFT JOIN shift sh ON sh.staff_id = s.id
        ORDER BY s.employee_no, sh.work_date
    """):
        rows.append([r[0], r[1], r[2], r[3] or "", ts(r[4], "%Y-%m-%d"), ts(r[5], "%Y-%m-%d"),
                     r[6] if r[6] is not None else "", ts(r[7], "%Y-%m-%d") if r[7] else "", r[8] or ""])
    views.append(("13_店员与排班", hdr, rows, [12, 10, 13, 20, 14, 12, 13, 12, 14]))

    # ---------- 14 会员购药汇总 ----------
    hdr = ["会员卡号", "姓名", "会员等级", "购药次数", "药品品种数", "购买盒数",
           "消费金额(元)", "累计获得积分"]
    rows = []
    for r in q("""
        SELECT m.card_no, m.name, ml.level_name,
               (SELECT COUNT(*) FROM sale_order o2 WHERE o2.member_id = m.id),
               (SELECT COALESCE(SUM(o2.points_earned), 0) FROM sale_order o2 WHERE o2.member_id = m.id),
               COUNT(DISTINCT d.id),
               COALESCE(SUM(i.quantity), 0),
               COALESCE(SUM(i.amount), 0)
        FROM sale_item i
        JOIN sale_order o ON o.id = i.sale_order_id
        JOIN member m ON m.id = o.member_id
        JOIN member_level ml ON ml.id = m.level_id
        JOIN drug_batch b ON b.id = i.batch_id
        JOIN drug d ON d.id = b.drug_id
        GROUP BY m.id
        ORDER BY SUM(i.amount) DESC
    """):
        rows.append([r[0], r[1], r[2], r[3], r[5], r[6], money(r[7]), r[4]])
    views.append(("14_会员购药汇总", hdr, rows, [13, 10, 11, 11, 12, 11, 14, 14]))

    # ---------- 15 会员购药明细 ----------
    hdr = ["会员卡号", "姓名", "会员等级", "销售单号", "购买时间", "药品名称", "规格",
           "生产企业", "批号", "数量", "单价(元)", "金额(元)", "是否会员价",
           "本次积分", "支付方式", "收银员"]
    rows = []
    for r in q("""
        SELECT m.card_no, m.name, ml.level_name, o.order_no, o.sold_at,
               d.name, d.spec, d.manufacturer, b.batch_no, i.quantity,
               i.unit_price, i.amount, o.is_member_price, o.points_earned,
               o.pay_method, st.name
        FROM sale_item i
        JOIN sale_order o ON o.id = i.sale_order_id
        JOIN member m ON m.id = o.member_id
        JOIN member_level ml ON ml.id = m.level_id
        JOIN drug_batch b ON b.id = i.batch_id
        JOIN drug d ON d.id = b.drug_id
        JOIN staff st ON st.id = o.staff_id
        ORDER BY o.sold_at DESC, i.id
    """):
        rows.append([r[0], r[1], r[2], r[3], ts(r[4]), r[5], r[6], r[7], r[8],
                     r[9], money(r[10]), money(r[11]), yn(r[12]), r[13], r[14], r[15]])
    views.append(("15_会员购药明细", hdr, rows,
                  [13, 10, 11, 14, 17, 22, 17, 26, 12, 8, 11, 11, 12, 10, 11, 10]))

    return views


def write_sheet_block(ws, start_row, headers, rows, widths):
    for c, h in enumerate(headers, start=1):
        cell = ws.cell(row=start_row, column=c, value=h)
        cell.fill = HEAD_FILL
        cell.font = HEAD_FONT
        cell.alignment = Alignment(horizontal="center")
        cell.border = BORDER
    for i, row in enumerate(rows, start=1):
        for c, v in enumerate(row, start=1):
            ws.cell(row=start_row + i, column=c, value=v).border = BORDER
    for i, w in enumerate(widths, start=1):
        cur_w = ws.column_dimensions[get_column_letter(i)].width or 0
        ws.column_dimensions[get_column_letter(i)].width = max(cur_w, w)


if __name__ == "__main__":
    raise SystemExit(main())
