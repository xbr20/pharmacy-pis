/**
 * 模拟数据初始化脚本（全部为虚构数据，不含任何真实患者/顾客信息）
 * 运行：npm run db:seed
 */
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

const hash = (pw) => crypto.createHash("sha256").update(`${pw}::pis`).digest("hex");
const DAY = 86400000;
const today = new Date();
today.setHours(0, 0, 0, 0);   // 时间基准归零到当天 0 点：所有时点与流水勾稽可复现
/** 以今天为基准偏移 n 天 */
const day = (n) => new Date(today.getTime() + n * DAY);

function levelOf(days) {
  if (days < 0) return "已过效期";
  if (days <= 7) return "待隔离";
  if (days <= 30) return "紧急";
  if (days <= 90) return "预警";
  return "在库";
}

const money = (n) => Number(Number(n).toFixed(2));

/** 积分：逢 8（8/18/28）双倍 —— 与 lib/rules.ts memberPoints 一致 */
function memberPoints(amount, date, pointRate = 1) {
  const base = Math.floor(amount * pointRate);
  const d = date.getDate();
  return d === 8 || d === 18 || d === 28 ? base * 2 : base;
}

async function main() {
  console.log("清空旧数据…");
  // 注意删除顺序：先删依赖方
  await prisma.auditLog.deleteMany();
  await prisma.pointLog.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stocktakeItem.deleteMany();
  await prisma.stocktake.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.saleOrder.deleteMany();
  await prisma.prescriptionItem.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.traceRecord.deleteMany();
  await prisma.expiryDisposal.deleteMany();
  await prisma.traceCode.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.drugBatch.deleteMany();
  await prisma.disposalRule.deleteMany();
  await prisma.member.deleteMany();
  await prisma.memberLevel.deleteMany();
  await prisma.rewardItem.deleteMany();
  await prisma.drug.deleteMany();
  await prisma.storageLocation.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.adminUser.deleteMany();

  // ---------- 管理员 ----------
  await prisma.adminUser.create({
    data: { username: "admin", passwordHash: hash("admin123"), name: "系统管理员", role: "管理员" }
  });

  // ---------- 会员等级 ----------
  const levels = await Promise.all(
    [
      { levelName: "普通会员", discountRate: 1.0, pointRate: 1.0, redeemThreshold: 100 },
      { levelName: "银卡会员", discountRate: 0.98, pointRate: 1.5, redeemThreshold: 200 },
      { levelName: "金卡会员", discountRate: 0.95, pointRate: 2.0, redeemThreshold: 300 }
    ].map((d) => prisma.memberLevel.create({ data: d }))
  );

  // ---------- 奖励品（积分兑换目录） ----------
  const rewards = [];
  for (const [rewardCode, name, pointsCost, stockQty, levelLimitId] of [
    ["RW01", "洗手液 500ml", 200, 60, null],
    ["RW02", "电子体温计", 500, 30, null],
    ["RW03", "家用血压计", 1500, 12, levels[1].id],
    ["RW04", "保健按摩枕", 3000, 5, levels[2].id]
  ]) {
    rewards.push(
      await prisma.rewardItem.create({ data: { rewardCode, name, pointsCost, stockQty, levelLimitId } })
    );
  }

  // ---------- 库位 ----------
  const locData = [
    ["A-01", "A 货架", "1 号柜", "常温避光"],
    ["A-02", "A 货架", "2 号柜", "常温避光"],
    ["A-03", "A 货架", "3 号柜", "常温避光"],
    ["B-01", "B 货架", "1 号柜", "阴凉（≤20℃）"],
    ["B-02", "B 货架", "2 号柜", "阴凉（≤20℃）"],
    ["C-01", "冷藏区", "冷藏柜 1", "2~8℃"],
    ["C-02", "冷藏区", "冷藏柜 2", "2~8℃"],
    ["D-01", "D 货架", "处方药专柜", "专柜加锁"],
    ["D-02", "D 货架", "处方药专柜 2", "专柜加锁"],
    ["E-01", "E 货架", "1 号柜", "常温避光"],
    ["E-02", "E 货架", "2 号柜", "常温避光"],
    ["F-01", "F 货架", "阴凉 1 号柜", "阴凉（≤20℃）"]
  ];
  const locs = await Promise.all(
    locData.map(([locationCode, shelfNo, cabinetNo, storageCondition]) =>
      prisma.storageLocation.create({
        data: { locationCode, shelfNo, cabinetNo, storageCondition }
      })
    )
  );

  // ---------- 店员 ----------
  const staffData = [
    ["E001", "王丽", "店长", "ZY2021008", 400, "2016-03-01"],
    ["E002", "李明", "店员", "ZY2022031", 190, "2019-06-15"],
    ["E003", "周芳", "店员", "ZY2023077", 95, "2021-09-01"],
    ["E004", "陈伟", "店员", null, null, "2022-04-11"],
    ["E005", "赵敏", "店员", "ZY2024120", 610, "2023-07-03"],
    ["E006", "孙强", "店员", null, null, "2024-01-08"]
  ];
  const staffs = [];
  for (const [employeeNo, name, post, pharmacistNo, expireOffset, hired] of staffData) {
    staffs.push(
      await prisma.staff.create({
        data: {
          employeeNo,
          name,
          post,
          pharmacistNo,
          pharmacistExpire: expireOffset === null ? null : day(expireOffset),
          hiredDate: new Date(hired)
        }
      })
    );
  }

  // ---------- 排班（未来 3 天） ----------
  const shifts = [];
  for (let d = 0; d < 3; d++) {
    const workDate = day(d);
    shifts.push({ staffId: staffs[0].id, workDate, timeRange: "08:00-16:00", shiftNo: "早班" });
    shifts.push({ staffId: staffs[(d + 1) % 5 + 1].id, workDate, timeRange: "08:00-16:00", shiftNo: "早班" });
    shifts.push({ staffId: staffs[(d + 2) % 5 + 1].id, workDate, timeRange: "14:00-22:00", shiftNo: "晚班" });
  }
  await prisma.shift.createMany({ data: shifts });

  // ---------- 会员 ----------
  const memberNames = ["张伟", "李娜", "王强", "刘洋", "陈静", "杨帆", "赵磊", "周敏", "吴涛", "徐丽",
    "孙鹏", "马晓燕", "郑浩", "林芳", "何军", "高倩", "罗宇", "谢兰", "宋涛", "唐悦"];
  const members = [];
  for (let i = 0; i < memberNames.length; i++) {
    members.push(
      await prisma.member.create({
        data: {
          cardNo: `M${String(1001 + i).padStart(6, "0")}`,
          levelId: levels[i % 3].id,
          name: memberNames[i],
          phone: `138****${String(1000 + i * 7).slice(-4)}`,
          birthDate: new Date(1968 + ((i * 3) % 30), (i * 5) % 12, (i % 27) + 1),
          totalPoints: 120 * (i + 1),
          healthNote: i % 4 === 0 ? "糖尿病，长期用药" : i % 4 === 1 ? "高血压" : null
        }
      })
    );
  }

  // ---------- 药品档案 ----------
  const drugData = [
    ["D0001", "阿莫西林胶囊", "0.25g×24 粒", "华北制药", true, true, 18.5, 12.2],
    ["D0002", "二甲双胍缓释片", "0.5g×30 片", "中美华东", true, true, 22.0, 14.6],
    ["D0003", "硝苯地平控释片", "30mg×7 片", "拜耳医药", true, true, 32.8, 23.4],
    ["D0004", "阿托伐他汀钙片", "20mg×7 片", "辉瑞制药", true, true, 26.5, 17.8],
    ["D0005", "布洛芬缓释胶囊", "0.3g×20 粒", "中美史克", false, true, 9.8, 5.6],
    ["D0006", "维生素 C 片", "100mg×100 片", "华中药业", false, false, 6.5, 3.2],
    ["D0007", "感冒灵颗粒", "10g×9 袋", "华润三九", false, true, 15.6, 9.8],
    ["D0008", "藿香正气水", "10ml×10 支", "太极集团", false, true, 12.0, 7.5],
    ["D0009", "蒙脱石散", "3g×10 袋", "博福益普生", false, true, 19.8, 13.0],
    ["D0010", "氯雷他定片", "10mg×6 片", "先灵葆雅", false, true, 16.5, 10.2],
    ["D0011", "左氧氟沙星片", "0.5g×6 片", "第一三共", true, true, 28.0, 19.4],
    ["D0012", "格列美脲片", "2mg×30 片", "赛诺菲", true, true, 35.5, 24.8],
    ["D0013", "门冬胰岛素注射液", "3ml:300U", "诺和诺德", true, true, 68.0, 52.0],
    ["D0014", "吸入用布地奈德", "1mg×5 支", "阿斯利康", true, true, 42.6, 30.5],
    ["D0015", "奥美拉唑肠溶胶囊", "20mg×14 粒", "阿斯利康", true, true, 24.8, 16.3],
    ["D0016", "复方丹参滴丸", "27mg×180 丸", "天士力", false, true, 38.0, 26.5],
    ["D0017", "六味地黄丸", "200 丸/瓶", "北京同仁堂", false, false, 21.5, 13.8],
    ["D0018", "钙尔奇 D 片", "600mg×60 片", "惠氏制药", false, true, 46.0, 32.0],
    ["D0019", "复方甘草片", "100 片/瓶", "太极集团", false, true, 8.9, 5.1],
    ["D0020", "生理性海水鼻腔喷雾", "50ml", "华熙生物", false, false, 29.9, 18.6],
    // —— 抗感染 ——
    ["D0021", "阿奇霉素片", "0.25g×6 片", "辉瑞制药", true, true, 32.0, 21.5],
    ["D0022", "头孢克肟分散片", "0.1g×12 片", "广州白云山", true, true, 28.5, 18.9],
    ["D0023", "罗红霉素胶囊", "0.15g×12 粒", "扬子江药业", true, true, 19.8, 12.4],
    ["D0024", "甲硝唑片", "0.2g×100 片", "华中药业", true, true, 8.5, 4.8],
    ["D0025", "诺氟沙星胶囊", "0.1g×24 粒", "广州白云山", true, true, 12.0, 7.2],
    // —— 呼吸系统 ——
    ["D0026", "盐酸氨溴索口服溶液", "100ml:0.6g", "勃林格殷格翰", false, true, 38.5, 25.6],
    ["D0027", "复方甲氧那明胶囊", "60 粒/瓶", "第一三共", true, true, 45.0, 30.2],
    ["D0028", "孟鲁司特钠片", "10mg×15 片", "默沙东", true, true, 68.0, 45.8],
    ["D0029", "硫酸沙丁胺醇吸入气雾剂", "100μg×200 喷", "葛兰素史克", true, true, 35.0, 23.5],
    ["D0030", "盐酸西替利嗪片", "10mg×12 片", "优时比制药", false, true, 22.8, 14.2],
    ["D0031", "氯雷他定糖浆", "60ml/瓶", "先灵葆雅", false, false, 26.0, 16.8],
    // —— 解热镇痛抗炎 ——
    ["D0032", "双氯芬酸钠缓释片", "75mg×10 片", "诺华制药", true, true, 24.5, 15.9],
    ["D0033", "塞来昔布胶囊", "0.2g×6 粒", "辉瑞制药", true, true, 52.0, 34.6],
    ["D0034", "对乙酰氨基酚片", "0.5g×20 片", "中美史克", false, true, 9.5, 5.4],
    ["D0035", "布洛芬混悬液", "100ml/瓶", "中美史克", false, true, 23.8, 15.2],
    // —— 消化系统 ——
    ["D0036", "铝碳酸镁咀嚼片", "0.5g×30 片", "拜耳医药", false, true, 29.5, 19.3],
    ["D0037", "雷贝拉唑钠肠溶片", "10mg×14 片", "卫材制药", true, true, 56.0, 37.2],
    ["D0038", "多潘立酮片", "10mg×30 片", "西安杨森", false, true, 18.6, 11.5],
    ["D0039", "枯草杆菌二联活菌肠溶胶囊", "250mg×30 粒", "北京韩美", false, true, 42.0, 27.8],
    ["D0040", "蒙脱石散（草莓味）", "3g×15 袋", "博福益普生", false, true, 26.5, 17.2],
    // —— 内分泌·降糖 ——
    ["D0041", "盐酸二甲双胍片", "0.25g×48 片", "正大天晴", true, true, 15.8, 9.6],
    ["D0042", "阿卡波糖片", "50mg×30 片", "拜耳医药", true, true, 62.0, 41.5],
    ["D0043", "格列齐特缓释片", "30mg×30 片", "施维雅制药", true, true, 48.5, 32.4],
    ["D0044", "瑞格列奈片", "1mg×30 片", "诺和诺德", true, true, 55.0, 36.8],
    ["D0045", "甘精胰岛素注射液", "3ml:300U", "赛诺菲", true, true, 178.0, 125.0],
    // —— 心脑血管 ——
    ["D0046", "苯磺酸氨氯地平片", "5mg×28 片", "辉瑞制药", true, true, 46.8, 31.2],
    ["D0047", "缬沙坦胶囊", "80mg×14 粒", "诺华制药", true, true, 52.5, 35.0],
    ["D0048", "琥珀酸美托洛尔缓释片", "47.5mg×14 片", "阿斯利康", true, true, 38.0, 25.4],
    ["D0049", "厄贝沙坦片", "0.15g×12 片", "赛诺菲", true, true, 42.0, 28.6],
    ["D0050", "氢氯噻嗪片", "25mg×100 片", "常州制药", true, true, 6.8, 3.9],
    ["D0051", "辛伐他汀片", "20mg×14 片", "默沙东", true, true, 39.5, 26.2],
    ["D0052", "瑞舒伐他汀钙片", "10mg×14 片", "阿斯利康", true, true, 78.0, 52.0],
    ["D0053", "阿司匹林肠溶片", "100mg×30 片", "拜耳医药", true, true, 18.5, 11.8],
    ["D0054", "硫酸氢氯吡格雷片", "75mg×14 片", "赛诺菲", true, true, 89.0, 59.5],
    ["D0055", "单硝酸异山梨酯缓释片", "40mg×14 片", "鲁南贝特", true, true, 34.5, 22.8],
    // —— 维生素与常用品 ——
    ["D0056", "叶酸片", "0.4mg×100 片", "北京斯利安", false, true, 12.5, 7.6],
    ["D0057", "维生素 D 滴剂", "400U×24 粒", "星鲨制药", false, false, 32.0, 20.5],
    ["D0058", "复方感冒灵片", "24 片/盒", "广州白云山", false, true, 13.8, 8.4],
    ["D0059", "川贝枇杷膏", "150ml/瓶", "京都念慈庵", false, false, 28.0, 18.2],
    ["D0060", "云南白药创可贴", "20 片/盒", "云南白药", false, false, 8.8, 5.2]
  ];
  const drugs = [];
  for (const [drugCode, name, spec, manufacturer, isPrescription, inMedicalInsurance, retailPrice, costPrice] of drugData) {
    drugs.push(
      await prisma.drug.create({
        data: { drugCode, name, spec, manufacturer, isPrescription, inMedicalInsurance, retailPrice, costPrice }
      })
    );
  }

  // ---------- 处置规则（效期阈值 → 建议动作） ----------
  const ruleRows = [
    ["R001", null, "处方药", 90, "退货", false],
    ["R002", null, "处方药", 30, "调拨", true],
    ["R003", null, "处方药", 7, "下架隔离", true],
    ["R004", null, "非处方药", 90, "促销", false],
    ["R005", null, "非处方药", 30, "退货", false],
    ["R006", null, "非处方药", 7, "报损", true]
  ];
  for (const [ruleCode, drugId, category, expiryDays, suggestedAction, needApproval] of ruleRows) {
    await prisma.disposalRule.create({
      data: { ruleCode, drugId, category, expiryDays, suggestedAction, needApproval }
    });
  }

  // ---------- 药品批次（效期覆盖 已过期 / ≤7 / ≤30 / ≤90 / 正常） ----------
  // 批次初始库存为 0：真正的库存只由 stock_movement 流水累加（任何改数都有来源）
  // 以运行当天为基准，覆盖 已过效期 / 待隔离≤7 / 紧急≤30 / 预警≤90 / 在库 五档，
  // 且让「已过效期」只占少量，避免随时间推移整体漂成过期
  const offsets = [-3, 2, 5, 12, 25, 45, 70, 95, 150, 240, 330, 480, 600, 720];
  const batches = [];
  for (let i = 0; i < drugs.length; i++) {
    const count = 1 + (i % 3); // 1~3 个批次
    for (let k = 0; k < count; k++) {
      const off = offsets[(i * 2 + k * 5) % offsets.length];
      const loc = locs[(i + k) % locs.length];
      batches.push(
        await prisma.drugBatch.create({
          data: {
            drugId: drugs[i].id,
            locationId: loc.id,
            batchNo: `B${String(2026000 + i * 10 + k).slice(0, 7)}`,
            expireDate: day(off),
            stockQty: 0,
            batchStatus: levelOf(off),
            flowStatus: k === 0 ? "正常" : k === 1 ? "待处理" : "正常"
          }
        })
      );
    }
  }

  // ---------- 库存流水：期初入库（每批一条，qtyBefore=0 → qtyAfter=期初数量） ----------
  for (let idx = 0; idx < batches.length; idx++) {
    const b = batches[idx];
    const drug = drugs.find((d) => d.id === b.drugId);
    const initQty = 20 + ((idx * 11) % 70);
    await prisma.stockMovement.create({
      data: {
        batchId: b.id,
        movementType: "期初入库",
        quantity: initQty,
        qtyBefore: 0,
        qtyAfter: initQty,
        costPrice: drug.costPrice,
        amount: money(Number(drug.costPrice) * initQty),
        sourceType: "期初结转",
        staffId: staffs[1].id,
        occurredAt: day(-400),
        remark: "系统初始化期初库存"
      }
    });
    b.stockQty = initQty;
    await prisma.drugBatch.update({ where: { id: b.id }, data: { stockQty: initQty } });
  }

  // ---------- 追溯码档案 ----------
  const traceCodes = [];
  for (let i = 0; i < 90; i++) {
    const b = batches[i % batches.length];
    const drug = drugs.find((d) => d.id === b.drugId);
    traceCodes.push(
      await prisma.traceCode.create({
        data: {
          code: `8110${String(100000 + i * 37)}${String(i).padStart(2, "0")}`,
          drugId: b.drugId,
          batchNo: b.batchNo,
          manufacturer: drug.manufacturer,
          verified: i % 3 !== 0
        }
      })
    );
  }

  // ---------- 追溯事件（入库 / 销售出库 / 撤销，一物一码按事件记录） ----------
  for (let i = 0; i < 60; i++) {
    const tc = traceCodes[i % traceCodes.length];
    const batch = batches.find((b) => b.batchNo === tc.batchNo);
    const roll = i % 12;
    const eventType = roll === 5 ? "销售出库" : roll === 11 ? "撤销" : "入库";
    await prisma.traceRecord.create({
      data: {
        traceCodeId: tc.id,
        batchId: batch ? batch.id : null,
        staffId: staffs[1 + (i % 5)].id,
        eventType,
        scannedAt: new Date(day(-(i % 12)).getTime() + i * 1800000),
        syncStatus: i % 9 === 8 ? "待补传" : "已同步",
        retryCount: i % 9 === 8 ? 1 : 0
      }
    });
  }

  // ---------- 处方 ----------
  const prescriptions = [];
  for (let i = 0; i < 14; i++) {
    const d = day(-(i % 9));
    prescriptions.push(
      await prisma.prescription.create({
        data: {
          rxNo: `RX2026${String(101 + i)}`,
          staffId: i % 2 === 0 ? staffs[1].id : null, // 部分由店员登记，部分来自线上
          doctorName: ["张建国", "李慧敏", "王振华", "刘志远", "陈晓芸"][i % 5],
          doctorLicence: `1101${String(20200000000 + i * 137)}`,
          rxDate: d,
          diagnosis: ["上呼吸道感染", "2 型糖尿病", "支气管哮喘", "高血压 2 级",
            "急性咽炎", "慢性胃炎", "高脂血症", "冠状动脉粥样硬化"][i % 8],
          rxType: "电子处方",
          channel: i % 3 === 0 ? "医院处方流转平台" : "PIS 手机端",
          autoVerified: i % 3 !== 2,
          verifiedAt: i % 3 !== 2 ? new Date(d.getTime() + 600000) : null,
          reviewerId: i % 3 !== 2 ? staffs[1].id : null,
          status: "已归档",
          signHash: crypto.createHash("sha256").update(`RX2026${101 + i}::电子签名`).digest("hex"),
          validUntil: new Date(d.getTime() + 3 * DAY),
          retainedUntil: new Date(d.getTime() + 365 * 5 * DAY)
        }
      })
    );
  }
  for (let i = 0; i < 28; i++) {
    await prisma.prescriptionItem.create({
      data: {
        prescriptionId: prescriptions[i % prescriptions.length].id,
        batchId: batches[(i * 3) % batches.length].id,
        dosage: ["口服，每日 2 次，每次 1 片", "餐前 30 分钟皮下注射，每次 6 单位",
          "口服，每日 1 次，每次 1 片", "口服，每日 3 次，每次 2 片", "雾化吸入，每日 2 次"][i % 5]
      }
    });
  }

  // 流水缓存：用于校验/计算任意时点的账面数（种子阶段的内存投影）
  // 按流水时间顺序回放：每次出库都从「该批次当前时刻的账面数」扣减，保证前后勾稽连续
  const movsCache = await prisma.stockMovement.findMany();
  const qtyAt = new Map(batches.map((b) => [b.id, b.stockQty]));
  const lastQtyAfter = (batchId) => {
    const ms = movsCache
      .filter((m) => m.batchId === batchId)
      .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt) || a.id - b.id);
    return ms.length ? Number(ms[ms.length - 1].qtyAfter) : null;
  };

  // 任意时点的账面数 = 该时点之前全部流水的净和（与前后勾稽等价，且不受先建盘点/后补销售的顺序影响）
  const latestQty = (batchId, before) => {
    const sum = movsCache
      .filter((m) => m.batchId === batchId && new Date(m.occurredAt) < before)
      .reduce((a, m) => a + Number(m.quantity), 0);
    return sum;
  };


  // ---------- 销售单与销售明细（会员价 / 积分 / 库存联动） ----------
  // 抽成函数：盘点之后还要补生成「今日销售单」，其时点必须晚于全部盘点调整流水，
  // 否则库存流水的时间序与生成序不一致，qtyBefore/qtyAfter 勾稽会断裂。
  // 确定性伪随机：同一 (n, salt) 每次 seed 得到相同结果 —— 数据可复现，
  // 但避免「i % 3」式取模造成的机械规律（否则每位会员都恰好 2 单 11 盒）
  const hash01 = (n, salt = 0) => {
    let h = Math.imul(n + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = (h ^ (h >>> 16)) >>> 0;
    return (h % 100000) / 100000;
  };

  async function createSale(i, soldAt) {
    const itemCount = 1 + Math.floor(hash01(i, 1) * 4); // 1~4 个品种
    const items = [];
    let total = 0;
    let discount = 0;
    // 约三成匿名购买；会员按伪随机挑选，故各会员购药次数自然不均
    const member = hash01(i, 3) < 0.3 ? null : members[Math.floor(hash01(i, 4) * members.length)];
    const level = member ? levels.find((l) => l.id === member.levelId) : null;
    const rate = level ? Number(level.discountRate) : 1;
    for (let k = 0; k < itemCount; k++) {
      const b = batches[(i * 3 + k) % batches.length];
      const drug = drugs.find((d) => d.id === b.drugId);
      const qty = 1 + Math.floor(hash01(i * 7 + k, 2) * 5); // 1~5 盒
      const retail = Number(drug.retailPrice);
      const unit = money(retail * rate);
      const amount = money(unit * qty);
      total += amount;
      discount += money((retail - unit) * qty);
      items.push({ batchId: b.id, quantity: qty, unitPrice: unit, amount });
    }
    total = money(total);
    const points = member ? memberPoints(total, soldAt, Number(level.pointRate)) : 0;
    const isInsurance = i % 3 === 2;
    const sale = await prisma.saleOrder.create({
      data: {
        orderNo: `SO2026${String(5001 + i)}`,
        memberId: member ? member.id : null,
        staffId: staffs[1 + (i % 5)].id,
        prescriptionId: i % 5 === 0 && i < 50 ? prescriptions[i % prescriptions.length].id : null,
        soldAt,
        receivable: total,
        received: total,
        payMethod: ["现金", "扫码", "医保"][i % 3],
        status: "已完成",
        isMemberPrice: !!member,
        pointsEarned: points,
        discountAmount: money(discount),
        insuranceNo: isInsurance ? `YB${String(900000 + i)}` : null,
        insuranceAmount: isInsurance ? money(total * 0.7) : 0,
        selfPayAmount: isInsurance ? money(total * 0.3) : 0,
        items: { create: items }
      }
    });

    // 库存流水：销售出库（台账只经流水变动）
    for (const it of items) {
      const b = batches.find((x) => x.id === it.batchId);
      const drug = drugs.find((d) => d.id === b.drugId);
      // 出库按「已发生流水的净额」推账面（含此前的盘点调整），与勾稽链一致
      const before = Number(qtyAt.get(b.id) ?? 0);
      const after = Math.max(0, before - it.quantity);
      qtyAt.set(b.id, after);
      b.stockQty = after;
      await prisma.drugBatch.update({ where: { id: b.id }, data: { stockQty: after } });
      const mv = await prisma.stockMovement.create({
        data: {
          batchId: b.id,
          movementType: "销售出库",
          quantity: -it.quantity,
          qtyBefore: before,
          qtyAfter: after,
          costPrice: drug.costPrice,
          amount: money(Number(drug.costPrice) * it.quantity),
          sourceType: "sale_order",
          sourceId: sale.id,
          saleOrderId: sale.id,
          staffId: sale.staffId,
          occurredAt: soldAt
        }
      });
      movsCache.push({ ...mv, occurredAt: soldAt });
      qtyAt.set(b.id, after);
    }

    // 积分流水
    if (member && points > 0) {
      const bal = member.totalPoints + points;
      await prisma.member.update({ where: { id: member.id }, data: { totalPoints: bal } });
      await prisma.pointLog.create({
        data: {
          memberId: member.id,
          saleOrderId: sale.id,
          changeType: "销售得分",
          points,
          balanceAfter: bal,
          operatedBy: sale.staffId,
          occurredAt: soldAt,
          remark: [8, 18, 28].includes(soldAt.getDate()) ? "会员日双倍积分" : null
        }
      });
      member.totalPoints = bal;
    }
  }

  // 历史销售单：-58 ~ -9 天，全部早于最早的盘点调整流水
  for (let i = 0; i < 50; i++) {
    await createSale(i, new Date(day(-58 + i).getTime() + 36000000 + (i % 8) * 1800000));
  }

  // ---------- 近效期处置（含待审批 / 待重试 / 已撤销状态） ----------
  const actions = ["退货", "调拨", "促销", "下架隔离", "报损"];
  const nearBatches = batches.filter((b) => {
    const d = Math.round((b.expireDate.getTime() - today.getTime()) / DAY);
    return d <= 90;
  });
  for (let i = 0; i < Math.min(24, nearBatches.length); i++) {
    const b = nearBatches[i];
    const action = actions[i % actions.length];
    const needApply = action === "退货" || action === "调拨";
    const pending = i % 5 === 3;
    await prisma.expiryDisposal.create({
      data: {
        batchId: b.id,
        staffId: staffs[1 + (i % 5)].id,
        action,
        quantity: Math.min(3, b.stockQty),
        disposedAt: new Date(day(-(i % 14)).getTime() + 40000000),
        deviationNote: i % 4 === 0 ? "系统建议退货，因供应商约期已过，改为下架隔离" : null,
        applyNo: needApply ? `AP2026${String(200 + i)}` : null,
        status: pending ? "待重试" : needApply ? "待审批" : "已登记",
        approvedBy: !needApply ? staffs[0].id : i % 2 === 0 ? staffs[0].id : null,
        approvedAt: !needApply || i % 2 === 0 ? day(-(i % 14) + 1) : null,
        retryCount: pending ? 2 : 0,
        lastError: pending ? "总部 ERP 无响应（超时 30s）" : null,
        revokedAt: i === 6 ? day(-3) : null,
        revokeReason: i === 6 ? "处置动作选错，撤销后重新登记" : null
      }
    });
  }

  // ---------- 盘点单与盘点明细（动态盘点：账面快照 + 期间销售） ----------
  // 账面快照 book_qty = 该时点之前全部流水的累计；实盘数由业务发生顺序倒推，
  // 账单差异写入 stock_movement（movement_type='盘点调整'），保证「流水合计 = 当前库存」
  const takeStates = [
    ["PD2026001", "全店盘点", -9, "已调账"],
    ["PD2026002", "处方药专柜", -5, "已调账"],
    ["PD2026003", "冷藏区", -2, "已调账"],
    ["PD2026004", "全店盘点", 0, "进行中"]
  ];
  for (let t = 0; t < takeStates.length; t++) {
    const [takeNo, scope, off, status] = takeStates[t];
    const baseTime = day(off);
    const items = [];
    for (let k = 0; k < 5; k++) {
      const b = batches[(t * 7 + k) % batches.length];
      const diff = k === 1 && t === 0 ? -2 : k === 2 && t === 1 ? -1 : k === 3 && t === 2 ? -3 : 0;
      // 动态盘点口径：账面数 = 该批次「此刻」的账面（销售已扣减，内部动作）
      const book = Number(qtyAt.get(b.id) ?? 0);
      const drug = drugs.find((d) => d.id === b.drugId);
      items.push({
        batchId: b.id,
        bookQty: book,
        countedQty: status === "进行中" ? (k === 3 ? 0 : book) : book,
        actualQty: status === "进行中" ? (k === 3 ? 0 : book) : book + diff,
        diffQty: status === "进行中" ? 0 : diff,
        diffAmount: status === "进行中" ? 0 : money(Math.abs(diff) * Number(drug.costPrice)),
        pendingEntry: status === "进行中" && k === 3
      });
    }
    const take = await prisma.stocktake.create({
      data: {
        takeNo,
        scope,
        baseTime,
        status,
        takeMode: "动态盘点",
        initiatedBy: staffs[t % 2 === 0 ? 0 : 1].id,
        reviewedBy: status === "已调账" ? staffs[0].id : null,
        finishedAt: status === "已调账" ? new Date(baseTime.getTime() + 5 * 3600000) : null,
        approvedAt: status === "已调账" ? new Date(baseTime.getTime() + 30 * 3600000) : null,
        items: { create: items }
      }
    });
    // 已调账：差异写库存流水（审批通过后回写台账），时点为盘点结束后 1 天
    if (status === "已调账") {
      for (const it of items) {
        if (it.diffQty === 0) continue;
        const drug = drugs.find((d) => d.id === batches.find((x) => x.id === it.batchId).drugId);
        const occurredAt = new Date(baseTime.getTime() + 26 * 3600000);
        const qtyBefore = Number(lastQtyAfter(it.batchId) ?? qtyAt.get(it.batchId) ?? 0);
        const mv = await prisma.stockMovement.create({
          data: {
            batchId: it.batchId,
            movementType: "盘点调整",
            quantity: it.diffQty,
            qtyBefore,
            qtyAfter: Math.max(0, Number(qtyBefore) + it.diffQty),
            costPrice: drug.costPrice,
            amount: money(Number(drug.costPrice) * Math.abs(it.diffQty)),
            sourceType: "stocktake",
            sourceId: take.id,
            stocktakeId: take.id,
            staffId: staffs[0].id,
            occurredAt,
            remark: "盘点差异经店长复核、总部审批通过后调账"
          }
        });
        movsCache.push({ ...mv, occurredAt });
        qtyAt.set(it.batchId, Math.max(0, Number(qtyBefore) + it.diffQty));
      }
    }
  }

  // ---------- 今日销售单：保证仪表盘「今日销售」指标恒有数据 ----------
  // 放在盘点之后生成 —— 时点最晚，不影响盘点账面快照与流水勾稽链
  for (let j = 0; j < 5; j++) {
    const i = 51 + j;
    let t = new Date(Date.now() - (3 - j) * 25 * 60000);
    // 若已跨过当天 0 点（凌晨运行），则回落到当天上午，确保仍落在「今天」
    if (t.getTime() < today.getTime()) t = new Date(today.getTime() + 9 * 3600000 + j * 1800000);
    await createSale(i, t);
  }

  // 台账最终与流水对齐（流水是唯一事实来源）
  for (const b of batches) {
    const sum = movsCache
      .filter((m) => m.batchId === b.id)
      .reduce((a, m) => a + m.quantity, 0);
    if (sum !== b.stockQty) await prisma.drugBatch.update({ where: { id: b.id }, data: { stockQty: sum } });
  }

  // ---------- 积分兑换（奖品出库 + 扣分流水） ----------
  {
    const m = members.find((x) => x.totalPoints >= 500) ?? members[0];
    const cost = rewards[1].pointsCost;
    const bal = m.totalPoints - cost;
    await prisma.member.update({ where: { id: m.id }, data: { totalPoints: bal } });
    await prisma.pointLog.create({
      data: {
        memberId: m.id,
        changeType: "兑换扣分",
        points: -cost,
        balanceAfter: bal,
        operatedBy: staffs[1].id,
        occurredAt: day(-2),
        remark: `兑换 ${rewards[1].name}`
      }
    });
  }

  // ---------- 审计日志 ----------
  for (let i = 0; i < 14; i++) {
    await prisma.auditLog.create({
      data: {
        staffId: staffs[i % staffs.length].id,
        action: ["登录", "登记处置", "提交盘点", "复核盘点", "调账", "撤销处置"][i % 6],
        targetType: ["system", "expiry_disposal", "stocktake", "stocktake", "stock_movement", "expiry_disposal"][i % 6],
        targetId: i + 1,
        detail: "模拟数据（演示操作留痕）",
        ip: `192.168.1.${10 + i}`,
        createdAt: day(-(i % 7))
      }
    });
  }

  const count = async (m) => prisma[m].count();
  console.log("模拟数据初始化完成：");
  for (const m of [
    "adminUser", "drug", "disposalRule", "memberLevel", "rewardItem", "traceCode", "storageLocation",
    "drugBatch", "staff", "member", "shift", "traceRecord", "expiryDisposal",
    "prescription", "prescriptionItem", "saleOrder", "saleItem", "stocktake", "stocktakeItem",
    "stockMovement", "pointLog", "auditLog"
  ]) {
    console.log(`  ${m.padEnd(18)} ${await count(m)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
