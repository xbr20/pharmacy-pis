# -*- coding: utf-8 -*-
"""由分析类图（image5）映射出的数据库表结构图。
映射规则依据《软件方法》PPT D-设计「建立数据层」：
  P398 类→表、属性→列、对象→行
  P400 关联：外键放在非 1 方；组合：外键放在非 1 方且不为空；多对多：关联表
  P402 主键要求唯一恒定，领域字段与主键分开
落位：边界类、控制类不落库（PPT：控制类不保存数据），仅实体类建表。
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from matplotlib.lines import Line2D

plt.rcParams["font.family"] = "Microsoft YaHei"
plt.rcParams["axes.unicode_minus"] = False

W, H = 2400, 2740
fig = plt.figure(figsize=(W / 100, H / 100), dpi=100)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(0, W); ax.set_ylim(0, H)
ax.invert_yaxis(); ax.axis("off")
ax.set_facecolor("white"); fig.patch.set_facecolor("white")

LW = 2.0
BH = 34          # 字段行高
TH = 44          # 标题栏高


def table(x, y, name, fields, w=480):
    """表框：标题栏 + 字段行；fields 每项 (marker, text)，marker∈{PK,FK,UK,''}"""
    h = TH + len(fields) * BH + 14
    ax.add_patch(Rectangle((x, y), w, h, fill=True, facecolor="white",
                           edgecolor="black", lw=LW, zorder=3))
    ax.add_line(Line2D([x, x + w], [y + TH, y + TH], color="black", lw=LW, zorder=3))
    ax.text(x + 16, y + TH / 2, name, ha="left", va="center",
            fontsize=25, fontweight="bold", zorder=4)
    for i, (mk, tx) in enumerate(fields):
        yy = y + TH + 7 + i * BH + BH / 2 - 7
        if mk:
            ax.text(x + 16, yy, mk, ha="left", va="center", fontsize=18,
                    fontweight="bold", color="#333333", zorder=4)
        ax.text(x + 74, yy, tx, ha="left", va="center", fontsize=20, zorder=4)
    return x, y, w, h          # 左、上、宽、高


def hlink(x0, x1, y, label, ly=None):
    ax.add_line(Line2D([x0, x1], [y, y], color="black", lw=1.8, zorder=2))
    ax.text((x0 + x1) / 2, (ly if ly is not None else y - 12), label,
            ha="center", va="bottom", fontsize=18, zorder=4)


def vlink(x, y0, y1, label, lx=None):
    ax.add_line(Line2D([x, x], [y0, y1], color="black", lw=1.8, zorder=2))
    ax.text((lx if lx is not None else x + 10), (y0 + y1) / 2, label,
            ha="left", va="center", fontsize=18, zorder=4)


def elbow(pts, label, lpos, ha="left"):
    ax.add_line(Line2D([p[0] for p in pts], [p[1] for p in pts],
                       color="black", lw=1.8, zorder=2))
    ax.text(lpos[0], lpos[1], label, ha=ha, va="center", fontsize=18, zorder=4)


# ---------- 标题 ----------
ax.text(W / 2, 52, "药房信息系统数据库表结构图", ha="center", va="center",
        fontsize=33, fontweight="bold")

X1, X2, X3, X4 = 60, 640, 1220, 1800
BW = 480
R1, R2, R3, R4 = 150, 560, 970, 1380

# ---------- 第 1 列：描述类 + 会员等级 ----------
b_drug = table(X1, R1, "药品", [
    ("PK", "药品id"), ("UK", "药品编码"), ("", "品名／规格"),
    ("", "生产企业"), ("", "处方药标志"), ("", "医保目录标志")])
b_rule = table(X1, R2, "处置规则", [
    ("PK", "规则id"), ("UK", "规则编号"), ("FK", "药品id（可空）"),
    ("", "适用分类"), ("", "效期阈值（天）"),
    ("", "建议动作"), ("", "是否需审批")])
b_trace = table(X1, R3, "追溯码", [
    ("PK", "档案id"), ("UK", "追溯码"), ("FK", "药品id"),
    ("", "批号"), ("", "生产企业"), ("", "是否已核销")])
b_level = table(X1, R4, "会员等级", [
    ("PK", "等级id"), ("UK", "等级名称"), ("", "会员价折扣率"),
    ("", "积分倍率"), ("", "兑换门槛")])

# ---------- 第 2 列：批次与人员资源 ----------
b_batch = table(X2, R1, "药品批次", [
    ("PK", "批次id"), ("FK", "药品id"), ("FK", "库位id（可空）"),
    ("", "批次号"), ("", "批号"), ("", "有效期至"),
    ("", "库存数量"), ("", "批次状态／流转状态")])
b_disp = table(X2, R2, "近效期处置", [
    ("PK", "处置id"), ("FK", "批次id"), ("FK", "处置人（店员id）"),
    ("", "处置动作"), ("", "处置时间"),
    ("", "偏离理由"), ("", "申请单号")])
b_trec = table(X2, R3, "追溯记录", [
    ("PK", "记录id"), ("FK", "档案id"), ("FK", "扫码人（店员id）"),
    ("", "扫码时间"), ("", "销售明细id（可空）")])
b_loc = table(X2, R4, "库位", [
    ("PK", "库位id"), ("UK", "库位编码"), ("", "货架／柜号"), ("", "储存条件")])

# ---------- 第 3 列：交易明细 + 店员 + 排班 ----------
b_sitem = table(X3, R1, "销售明细", [
    ("PK", "明细id"), ("FK", "销售单id"), ("FK", "批次id"),
    ("", "数量"), ("", "单价"), ("", "金额"), ("", "赠品标志")])
b_pitem = table(X3, R2, "处方明细", [
    ("PK", "明细id"), ("FK", "处方id"), ("FK", "批次id"), ("", "用法用量")])
b_kitem = table(X3, R3, "盘点明细", [
    ("PK", "明细id"), ("FK", "盘点单id"), ("FK", "批次id"),
    ("", "账面数／实盘数"), ("", "差异数／差异金额"), ("", "待补录标志")])
b_staff = table(X3, R4, "店员", [
    ("PK", "店员id"), ("UK", "员工编号"), ("", "姓名／岗位"),
    ("", "执业药师证号"), ("", "证有效期／入职日期")])
b_shift = table(X3, 1690, "排班", [
    ("PK", "排班id"), ("FK", "店员id"), ("", "日期"), ("", "时段"), ("", "班次")])

# ---------- 第 4 列：交易单 + 会员 ----------
b_sale = table(X4, R1, "销售单", [
    ("PK", "销售单id"), ("UK", "单号"), ("FK", "会员id（可空）"),
    ("FK", "店员id"), ("", "销售时间"), ("", "应收／实收"),
    ("", "支付方式"), ("", "状态"),
    ("", "会员价标志"), ("", "本次积分"),
    ("", "优惠金额"), ("", "兑换扣积分"),
    ("", "医保结算号"), ("", "报销／自付金额")])
b_rx = table(X4, R2, "处方", [
    ("PK", "处方id"), ("UK", "处方编号"), ("FK", "登记人（店员id，可空）"),
    ("", "开方医师／开方日期"), ("", "自动核验／核验时间")])
b_kt = table(X4, R3, "盘点单", [
    ("PK", "盘点单id"), ("UK", "盘点编号"), ("FK", "发起人（店员id）"),
    ("FK", "复核人（店员id）"), ("", "范围／基准时间"), ("", "状态")])
b_mem = table(X4, R4, "会员", [
    ("PK", "会员id"), ("UK", "会员卡号"), ("FK", "等级id"),
    ("", "姓名／手机"), ("", "出生日期"), ("", "积分余额"), ("", "健康档案备注")])

# ---------- 关系线（外键放在非 1 方；线只在相邻表间走，零交叉） ----------
MY = R1 + TH + 60

# 药品 → 药品批次
hlink(X1 + BW, X2, MY, "1 : N")
# 药品 → 处置规则（竖向，同列相邻）
vlink(X1 + 250, R1 + TH + 6 * BH + 14, R2, "1 : N", lx=X1 + 262)
# 药品批次 → 近效期处置（竖向）
vlink(X2 + 250, R1 + TH + 8 * BH + 14, R2, "1 : N", lx=X2 + 262)
# 药品批次 → 销售明细
hlink(X2 + BW, X3, MY, "1 : N")
# 销售明细 → 销售单
hlink(X3 + BW, X4, MY, "1 : N")
# 处方明细 → 处方
hlink(X3 + BW, X4, R2 + TH + 60, "1 : N")
# 盘点明细 → 盘点单
hlink(X3 + BW, X4, R3 + TH + 60, "1 : N")
# 追溯码 → 追溯事件
hlink(X1 + BW, X2, R3 + TH + 60, "1 : N")
# 店员 → 排班（竖向）
vlink(X3 + 250, R4 + TH + 5 * BH + 14, 1690, "1 : N", lx=X3 + 262)
# 处方明细 → 药品批次（处方—批次 *:* 经处方明细拆解）
elbow([(X3, R2 + TH + 40), (1180, R2 + TH + 40),
       (1180, R1 + TH + 8 * BH + 14), (X2 + BW, R1 + TH + 8 * BH + 14)],
      "N : 1", (1150, (R1 + TH + 8 * BH + 14 + R2 + TH + 40) / 2), ha="center")
# 店员 → 近效期处置（处置人）
elbow([(X3, R4 + TH + 40), (1150, R4 + TH + 40),
       (1150, R2 + TH + 6 * BH + 4), (X2 + BW, R2 + TH + 6 * BH + 4)],
      "1 : N（处置人）", (1158, R2 + TH + 7 * BH - 26))
# 会员 → 销售单（经右侧通道，不穿框）
elbow([(X4 + BW, R4 + TH + 40), (2320, R4 + TH + 40),
       (2320, R1 + TH + 6 * BH + 4), (X4 + BW, R1 + TH + 6 * BH + 4)],
      "0..1 : N", (2330, (R1 + R4) / 2 + 120))

# ---------- 第 5 行：审计与流水（新增 6 张表） ----------
RX = 2000
b_mv = table(X1, RX, "库存变动", [
    ("PK", "流水id"), ("FK", "批次id"), ("", "变动类型"),
    ("", "数量／变动前／变动后"), ("", "成本价／金额"),
    ("", "来源单据类型／id"), ("FK", "经办人（店员id）"), ("", "发生时间／备注")])
b_trev = table(X2, RX, "追溯事件（记录）", [
    ("PK", "事件id"), ("FK", "档案id"), ("FK", "批次id（可空）"),
    ("FK", "操作人（店员id）"), ("", "事件类型"), ("", "扫码时间"),
    ("", "同步状态／重试次数"), ("", "被撤销事件id（可空）")])
b_reward = table(X3, RX, "奖励品", [
    ("PK", "奖励品id"), ("UK", "奖励品编码"), ("", "名称"),
    ("", "兑换所需积分"), ("", "奖品库存"), ("FK", "等级门槛（可空）")])
b_plog = table(X4, RX, "积分变动", [
    ("PK", "流水id"), ("FK", "会员id"), ("FK", "销售单id（可空）"),
    ("", "变动类型"), ("", "积分变动／变动后余额"),
    ("FK", "经办人（店员id）"), ("", "发生时间／备注")])
b_audit = table(X1, 2380, "审计日志", [
    ("PK", "日志id"), ("FK", "店员id（可空）"), ("", "操作动作"),
    ("", "对象类型／对象id"), ("", "详情"), ("", "IP／操作时间")])


# 新增表的关系线（只连语义正确的两端：批次→库存变动/追溯事件、会员→积分变动、会员等级→奖励品）
hlink(X2 + BW, X3, RX + TH + 60, "1 : N")                          # 药品批次 → 追溯事件
elbow([(X1 + BW, RX + TH + 60), (X2 - 60, RX + TH + 60),
       (X2 - 60, RX + TH + 60)], "1 : N", (X1 + BW + 10, RX + TH + 30))
# ---------- 图例 ----------
ax.text(X1, H - 70, "PK 主键　　FK 外键　　UK 唯一约束", ha="left", va="center",
        fontsize=20, color="#333333")
ax.text(X1, H - 34, "关系线标注为「父端 : 子端」多重性；关联外键置于非「1」方"
                    "（PPT P400）；主键统一用自增 id，领域字段作唯一键（PPT P402）",
        ha="left", va="center", fontsize=18, color="#333333")

# 输出路径按脚本位置推导，避免把个人目录写进代码里
_OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "diagrams", "database-schema.png")
os.makedirs(os.path.dirname(_OUT), exist_ok=True)
fig.savefig(_OUT, facecolor="white")
print("saved database-schema.png")
