-- ============================================================
-- 药房信息系统（PIS）建表脚本（PostgreSQL）
-- 由分析类图映射生成，映射规则见 docs/database-design.md
-- 主键统一自增 id（领域字段作唯一键）；外键置于非"1"方
-- 共 22 张表：核心域 21 张（描述类 5 + 事物类 7 + 时刻时段类 9）
--            + 系统级 1 张（admin_user，登录用，不属核心域）
-- ============================================================

-- ---------- 描述类 ----------

-- 药品（含零售价/成本价：会员计价、库存金额、损耗金额均依赖）
CREATE TABLE drug (
    id              SERIAL PRIMARY KEY,
    drug_code       VARCHAR(32)  NOT NULL UNIQUE,   -- 药品编码（UK）
    name            VARCHAR(128) NOT NULL,          -- 品名
    spec            VARCHAR(64),                    -- 规格
    manufacturer    VARCHAR(128),                   -- 生产企业
    is_prescription BOOLEAN      NOT NULL DEFAULT FALSE,
    in_medical_insurance BOOLEAN NOT NULL DEFAULT FALSE,
    retail_price    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (retail_price >= 0), -- 零售价（会员价=零售价×折扣率）
    cost_price      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0)   -- 成本价（库存金额、损耗金额）
);

-- 处置规则（近效期处置的建议动作）
CREATE TABLE disposal_rule (
    id              SERIAL PRIMARY KEY,
    rule_code       VARCHAR(32)  NOT NULL UNIQUE,
    drug_id         INTEGER REFERENCES drug(id),    -- 可空：按分类通用时不指定药品
    category        VARCHAR(64),
    expiry_days     INTEGER      NOT NULL,
    suggested_action VARCHAR(32) NOT NULL,          -- 退货/调拨/促销/下架隔离/报损
    need_approval   BOOLEAN      NOT NULL DEFAULT FALSE
);

-- 会员等级
CREATE TABLE member_level (
    id               SERIAL PRIMARY KEY,
    level_name       VARCHAR(32)  NOT NULL UNIQUE,
    discount_rate    NUMERIC(4,3) NOT NULL,          -- 会员价折扣率
    point_rate       NUMERIC(4,2) NOT NULL DEFAULT 1,-- 积分倍率
    redeem_threshold INTEGER      NOT NULL DEFAULT 0 -- 积分兑换门槛
);

-- 积分兑换奖励品（目录）
CREATE TABLE reward_item (
    id             SERIAL PRIMARY KEY,
    reward_code    VARCHAR(32) NOT NULL UNIQUE,
    name           VARCHAR(128) NOT NULL,
    points_cost    INTEGER     NOT NULL CHECK (points_cost > 0), -- 兑换所需积分
    stock_qty      INTEGER     NOT NULL DEFAULT 0,               -- 奖品库存
    level_limit_id INTEGER REFERENCES member_level(id),          -- 兑换的会员等级门槛；空=不限
    status         VARCHAR(16) NOT NULL DEFAULT '在售'
);

-- 追溯码（一物一码）
CREATE TABLE trace_code (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(64)  NOT NULL UNIQUE,   -- 追溯码（全国唯一）
    drug_id         INTEGER      NOT NULL REFERENCES drug(id),
    batch_no        VARCHAR(64)  NOT NULL,
    manufacturer    VARCHAR(128),
    verified        BOOLEAN      NOT NULL DEFAULT FALSE  -- 是否已核销
);

-- ---------- 事物类 ----------

-- 库位
CREATE TABLE storage_location (
    id              SERIAL PRIMARY KEY,
    location_code   VARCHAR(32)  NOT NULL UNIQUE,
    shelf_no        VARCHAR(32),
    cabinet_no      VARCHAR(32),
    storage_condition VARCHAR(64)
);

-- 药品批次
CREATE TABLE drug_batch (
    id              SERIAL PRIMARY KEY,
    drug_id         INTEGER      NOT NULL REFERENCES drug(id),
    location_id     INTEGER REFERENCES storage_location(id),
    batch_no        VARCHAR(64)  NOT NULL,
    expire_date     DATE         NOT NULL,          -- 有效期至（按“日”精度，效期分级依赖它）
    stock_qty       INTEGER      NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    batch_status    VARCHAR(16)  NOT NULL DEFAULT '在库',
    flow_status     VARCHAR(16)  NOT NULL DEFAULT '正常',
    UNIQUE (drug_id, batch_no)
);

-- 店员
CREATE TABLE staff (
    id              SERIAL PRIMARY KEY,
    employee_no     VARCHAR(32)  NOT NULL UNIQUE,
    name            VARCHAR(64)  NOT NULL,
    post            VARCHAR(32)  NOT NULL,          -- 岗位：店员/店长
    pharmacist_no   VARCHAR(64),                    -- 执业药师证号
    pharmacist_expire DATE,
    hired_date      DATE
);

-- 会员
CREATE TABLE member (
    id              SERIAL PRIMARY KEY,
    card_no         VARCHAR(32)  NOT NULL UNIQUE,
    level_id        INTEGER      NOT NULL REFERENCES member_level(id),
    name            VARCHAR(64),
    phone           VARCHAR(20),
    birth_date      DATE,
    total_points    INTEGER      NOT NULL DEFAULT 0 CHECK (total_points >= 0),
    health_note     TEXT
);

-- 排班（角色）
CREATE TABLE shift (
    id              SERIAL PRIMARY KEY,
    staff_id        INTEGER      NOT NULL REFERENCES staff(id),
    work_date       DATE         NOT NULL,
    time_range      VARCHAR(32)  NOT NULL,
    shift_no        VARCHAR(16)  NOT NULL,
    UNIQUE (staff_id, work_date, shift_no)
);

-- ---------- 时刻时段类 ----------

-- 追溯事件（入库扫码 / 销售出库 / 退货入库 / 撤销：一码多事件）
CREATE TABLE trace_record (
    id              SERIAL PRIMARY KEY,
    trace_code_id   INTEGER      NOT NULL REFERENCES trace_code(id),
    staff_id        INTEGER      NOT NULL REFERENCES staff(id),
    event_type      VARCHAR(16)  NOT NULL DEFAULT '入库',  -- 入库/销售出库/退货入库/撤销
    batch_id        INTEGER REFERENCES drug_batch(id),     -- 事件发生的批次
    scanned_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sale_item_id    INTEGER,                               -- 销售出库时关联销售明细
    sync_status     VARCHAR(16)  NOT NULL DEFAULT '已同步',-- 已同步/待补传/补传失败
    synced_at       TIMESTAMP,
    retry_count     INTEGER      NOT NULL DEFAULT 0,
    revokes_id      INTEGER                                -- 撤销事件指向被撤销的原事件
);

-- 处方
CREATE TABLE prescription (
    id             SERIAL PRIMARY KEY,
    rx_no          VARCHAR(32) NOT NULL UNIQUE,
    staff_id       INTEGER REFERENCES staff(id),           -- 登记/接收店员
    doctor_name    VARCHAR(64) NOT NULL,                   -- 开方医师
    doctor_licence VARCHAR(32),                            -- 医师执业证书编号
    rx_date        DATE        NOT NULL,
    diagnosis      VARCHAR(256),                           -- 临床诊断（处方要素）
    rx_type        VARCHAR(16) NOT NULL DEFAULT '电子处方', -- 电子处方/纸质处方
    channel        VARCHAR(32) NOT NULL DEFAULT 'PIS 手机端',
    auto_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
    verified_at    TIMESTAMP,
    reviewer_id    INTEGER REFERENCES staff(id),           -- 复核药师（须持有效证）
    status         VARCHAR(16) NOT NULL DEFAULT '已归档',
    sign_hash      VARCHAR(128),                           -- 电子签名摘要（不可篡改）
    valid_until    TIMESTAMP,                              -- 处方有效期
    retained_until TIMESTAMP                               -- 保存到期日（GSP 处方保存不少于 5 年）
);

-- 处方明细（处方—批次 *:* 经关联表拆解）
CREATE TABLE prescription_item (
    id              SERIAL PRIMARY KEY,
    prescription_id INTEGER      NOT NULL REFERENCES prescription(id),
    batch_id        INTEGER      NOT NULL REFERENCES drug_batch(id),
    dosage          VARCHAR(128) NOT NULL
);

-- 销售单
CREATE TABLE sale_order (
    id              SERIAL PRIMARY KEY,
    order_no        VARCHAR(32)  NOT NULL UNIQUE,
    member_id       INTEGER REFERENCES member(id),          -- 可空：匿名购药
    staff_id        INTEGER      NOT NULL REFERENCES staff(id),
    prescription_id INTEGER REFERENCES prescription(id),    -- 处方药销售必须绑定处方
    sold_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    receivable      NUMERIC(10,2) NOT NULL,
    received        NUMERIC(10,2) NOT NULL,
    pay_method      VARCHAR(16)  NOT NULL,                  -- 现金/扫码/医保
    status          VARCHAR(16)  NOT NULL DEFAULT '已完成',  -- 已完成/已退货
    is_member_price BOOLEAN      NOT NULL DEFAULT FALSE,
    points_earned   INTEGER      NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    points_redeemed INTEGER      NOT NULL DEFAULT 0,
    insurance_no    VARCHAR(32),
    insurance_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    self_pay_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    return_of_id    INTEGER REFERENCES sale_order(id)       -- 退货单指向原销售单
);

-- 销售明细（组合，外键不为空）
CREATE TABLE sale_item (
    id              SERIAL PRIMARY KEY,
    sale_order_id   INTEGER      NOT NULL REFERENCES sale_order(id),
    batch_id        INTEGER      NOT NULL REFERENCES drug_batch(id),
    quantity        INTEGER      NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(10,2) NOT NULL,
    amount          NUMERIC(10,2) NOT NULL,
    is_gift         BOOLEAN      NOT NULL DEFAULT FALSE,
    reward_id       INTEGER REFERENCES reward_item(id)     -- 积分兑换出库指向奖励品
);

-- 近效期处置（含审批、重试、撤销状态）
CREATE TABLE expiry_disposal (
    id              SERIAL PRIMARY KEY,
    batch_id        INTEGER      NOT NULL REFERENCES drug_batch(id),
    staff_id        INTEGER      NOT NULL REFERENCES staff(id),
    action          VARCHAR(16)  NOT NULL,
    quantity        INTEGER      NOT NULL DEFAULT 0,        -- 处置数量
    disposed_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deviation_note  TEXT,
    apply_no        VARCHAR(32),
    status          VARCHAR(16)  NOT NULL DEFAULT '已登记',  -- 已登记/待审批/已通过/已驳回/待重试/部分完成/已撤销
    approved_by     INTEGER REFERENCES staff(id),
    approved_at     TIMESTAMP,
    retry_count     INTEGER      NOT NULL DEFAULT 0,
    last_error      VARCHAR(256),
    revoked_at      TIMESTAMP,
    revoke_reason   VARCHAR(256)
);

-- 盘点单
CREATE TABLE stocktake (
    id              SERIAL PRIMARY KEY,
    take_no         VARCHAR(32)  NOT NULL UNIQUE,
    scope           VARCHAR(128),
    base_time       TIMESTAMP    NOT NULL,                 -- 账面快照基准时点（动态盘点）
    status          VARCHAR(16)  NOT NULL DEFAULT '进行中', -- 进行中/待复核/已调账/待整改
    take_mode       VARCHAR(16)  NOT NULL DEFAULT '动态盘点',
    initiated_by    INTEGER      NOT NULL REFERENCES staff(id),
    reviewed_by     INTEGER REFERENCES staff(id),
    finished_at     TIMESTAMP,
    approved_at     TIMESTAMP
);

-- 盘点明细（组合，外键不为空）
CREATE TABLE stocktake_item (
    id              SERIAL PRIMARY KEY,
    stocktake_id    INTEGER      NOT NULL REFERENCES stocktake(id),
    batch_id        INTEGER      NOT NULL REFERENCES drug_batch(id),
    book_qty        INTEGER      NOT NULL,                 -- 账面快照数（base_time 时点）
    counted_qty     INTEGER      NOT NULL DEFAULT 0,       -- 已盘数（扫描累计；未盘=0）
    actual_qty      INTEGER      NOT NULL,                 -- 盘点结束时的实盘数
    diff_qty        INTEGER      NOT NULL,                 -- 差异数
    diff_amount     NUMERIC(10,2) NOT NULL,
    pending_entry   BOOLEAN      NOT NULL DEFAULT FALSE,
    UNIQUE (stocktake_id, batch_id)                        -- 同一盘点单内一个批次只出现一次
);

-- 库存变动（任何改数的唯一入口；审计“谁在何时因何改数”）
CREATE TABLE stock_movement (
    id              SERIAL PRIMARY KEY,
    batch_id        INTEGER      NOT NULL REFERENCES drug_batch(id),
    movement_type   VARCHAR(16)  NOT NULL,                 -- 期初入库/采购入库/销售出库/销售退回/盘点调整/盘盈/盘亏/报废出库/赠品出库
    quantity        INTEGER      NOT NULL,                 -- 变动数量（入正出负）
    qty_before      INTEGER      NOT NULL,
    qty_after       INTEGER      NOT NULL CHECK (qty_after >= 0),
    cost_price      NUMERIC(10,2) NOT NULL DEFAULT 0,
    amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
    source_type     VARCHAR(32)  NOT NULL,                 -- 来源单据类型
    source_id       INTEGER,                               -- 来源单据 id
    stocktake_id    INTEGER REFERENCES stocktake(id),
    sale_order_id   INTEGER REFERENCES sale_order(id),
    staff_id        INTEGER REFERENCES staff(id),
    occurred_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remark          VARCHAR(256)
);

-- 积分变动（销售得分 / 兑换扣分 / 退货回滚）
CREATE TABLE point_log (
    id              SERIAL PRIMARY KEY,
    member_id       INTEGER      NOT NULL REFERENCES member(id),
    sale_order_id   INTEGER REFERENCES sale_order(id),
    change_type     VARCHAR(16)  NOT NULL,                 -- 销售得分/兑换扣分/退货回滚/手工调整
    points          INTEGER      NOT NULL,                 -- 正=得分，负=扣分
    balance_after   INTEGER      NOT NULL,
    operated_by     INTEGER REFERENCES staff(id),
    occurred_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remark          VARCHAR(256)
);

-- 操作审计日志
CREATE TABLE audit_log (
    id              SERIAL PRIMARY KEY,
    staff_id        INTEGER REFERENCES staff(id),
    action          VARCHAR(32)  NOT NULL,
    target_type     VARCHAR(32)  NOT NULL,
    target_id       INTEGER,
    detail          TEXT,
    ip              VARCHAR(64),
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 索引（常用查询路径） ----------
CREATE INDEX idx_batch_drug      ON drug_batch(drug_id);
CREATE INDEX idx_batch_expire    ON drug_batch(expire_date);
CREATE INDEX idx_sale_item_sale  ON sale_item(sale_order_id);
CREATE INDEX idx_sale_item_batch ON sale_item(batch_id);
CREATE INDEX idx_sale_order_rx   ON sale_order(prescription_id);
CREATE INDEX idx_disposal_batch  ON expiry_disposal(batch_id);
CREATE INDEX idx_disposal_status ON expiry_disposal(status);
CREATE INDEX idx_stocktake_item_take ON stocktake_item(stocktake_id);
CREATE INDEX idx_trace_record_code ON trace_record(trace_code_id);
CREATE INDEX idx_trace_record_batch ON trace_record(batch_id);
CREATE INDEX idx_movement_batch  ON stock_movement(batch_id, occurred_at);
CREATE INDEX idx_movement_source ON stock_movement(source_type, source_id);
CREATE INDEX idx_point_member    ON point_log(member_id, occurred_at);
CREATE INDEX idx_audit_target    ON audit_log(target_type, target_id);
