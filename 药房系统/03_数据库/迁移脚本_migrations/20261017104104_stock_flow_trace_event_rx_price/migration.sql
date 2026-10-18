-- CreateTable
CREATE TABLE "stock_movement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batch_id" INTEGER NOT NULL,
    "movement_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "qty_before" INTEGER NOT NULL,
    "qty_after" INTEGER NOT NULL,
    "cost_price" DECIMAL NOT NULL DEFAULT 0,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "source_type" TEXT NOT NULL,
    "source_id" INTEGER,
    "staff_id" INTEGER,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remark" TEXT,
    "stocktake_id" INTEGER,
    "sale_order_id" INTEGER,
    CONSTRAINT "stock_movement_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "drug_batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movement_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stock_movement_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "stocktake" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stock_movement_sale_order_id_fkey" FOREIGN KEY ("sale_order_id") REFERENCES "sale_order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "point_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member_id" INTEGER NOT NULL,
    "sale_order_id" INTEGER,
    "change_type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "operated_by" INTEGER,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remark" TEXT,
    CONSTRAINT "point_log_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "point_log_sale_order_id_fkey" FOREIGN KEY ("sale_order_id") REFERENCES "sale_order" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "point_log_operated_by_fkey" FOREIGN KEY ("operated_by") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reward_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reward_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "points_cost" INTEGER NOT NULL,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "level_limit_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT '在售'
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staff_id" INTEGER,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER,
    "detail" TEXT,
    "ip" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_drug" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "drug_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "manufacturer" TEXT,
    "is_prescription" BOOLEAN NOT NULL DEFAULT false,
    "in_medical_insurance" BOOLEAN NOT NULL DEFAULT false,
    "retail_price" DECIMAL NOT NULL DEFAULT 0,
    "cost_price" DECIMAL NOT NULL DEFAULT 0
);
INSERT INTO "new_drug" ("drug_code", "id", "in_medical_insurance", "is_prescription", "manufacturer", "name", "spec") SELECT "drug_code", "id", "in_medical_insurance", "is_prescription", "manufacturer", "name", "spec" FROM "drug";
DROP TABLE "drug";
ALTER TABLE "new_drug" RENAME TO "drug";
CREATE UNIQUE INDEX "drug_drug_code_key" ON "drug"("drug_code");
CREATE TABLE "new_expiry_disposal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batch_id" INTEGER NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "disposed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviation_note" TEXT,
    "apply_no" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT '已登记',
    "approved_by" INTEGER,
    "approved_at" DATETIME,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "revoked_at" DATETIME,
    "revoke_reason" TEXT,
    CONSTRAINT "expiry_disposal_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "drug_batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "expiry_disposal_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_expiry_disposal" ("action", "apply_no", "batch_id", "deviation_note", "disposed_at", "id", "staff_id") SELECT "action", "apply_no", "batch_id", "deviation_note", "disposed_at", "id", "staff_id" FROM "expiry_disposal";
DROP TABLE "expiry_disposal";
ALTER TABLE "new_expiry_disposal" RENAME TO "expiry_disposal";
CREATE TABLE "new_prescription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rx_no" TEXT NOT NULL,
    "staff_id" INTEGER,
    "doctor_name" TEXT NOT NULL,
    "doctor_licence" TEXT,
    "rx_date" DATETIME NOT NULL,
    "diagnosis" TEXT,
    "rx_type" TEXT NOT NULL DEFAULT '电子处方',
    "channel" TEXT NOT NULL DEFAULT 'PIS 手机端',
    "auto_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" DATETIME,
    "reviewer_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT '已归档',
    "sign_hash" TEXT,
    "valid_until" DATETIME,
    "retained_until" DATETIME,
    CONSTRAINT "prescription_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_prescription" ("auto_verified", "doctor_name", "id", "rx_date", "rx_no", "staff_id", "verified_at") SELECT "auto_verified", "doctor_name", "id", "rx_date", "rx_no", "staff_id", "verified_at" FROM "prescription";
DROP TABLE "prescription";
ALTER TABLE "new_prescription" RENAME TO "prescription";
CREATE UNIQUE INDEX "prescription_rx_no_key" ON "prescription"("rx_no");
CREATE TABLE "new_sale_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sale_order_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL,
    "is_gift" BOOLEAN NOT NULL DEFAULT false,
    "reward_id" INTEGER,
    CONSTRAINT "sale_item_sale_order_id_fkey" FOREIGN KEY ("sale_order_id") REFERENCES "sale_order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sale_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "drug_batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sale_item_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "reward_item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sale_item" ("amount", "batch_id", "id", "is_gift", "quantity", "sale_order_id", "unit_price") SELECT "amount", "batch_id", "id", "is_gift", "quantity", "sale_order_id", "unit_price" FROM "sale_item";
DROP TABLE "sale_item";
ALTER TABLE "new_sale_item" RENAME TO "sale_item";
CREATE TABLE "new_sale_order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_no" TEXT NOT NULL,
    "member_id" INTEGER,
    "staff_id" INTEGER NOT NULL,
    "prescription_id" INTEGER,
    "sold_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivable" DECIMAL NOT NULL,
    "received" DECIMAL NOT NULL,
    "pay_method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '已完成',
    "is_member_price" BOOLEAN NOT NULL DEFAULT false,
    "points_earned" INTEGER NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL NOT NULL DEFAULT 0,
    "points_redeemed" INTEGER NOT NULL DEFAULT 0,
    "insurance_no" TEXT,
    "insurance_amount" DECIMAL NOT NULL DEFAULT 0,
    "self_pay_amount" DECIMAL NOT NULL DEFAULT 0,
    "return_of_id" INTEGER,
    CONSTRAINT "sale_order_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sale_order_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sale_order_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sale_order_return_of_id_fkey" FOREIGN KEY ("return_of_id") REFERENCES "sale_order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sale_order" ("discount_amount", "id", "insurance_amount", "insurance_no", "is_member_price", "member_id", "order_no", "pay_method", "points_earned", "points_redeemed", "receivable", "received", "self_pay_amount", "sold_at", "staff_id", "status") SELECT "discount_amount", "id", "insurance_amount", "insurance_no", "is_member_price", "member_id", "order_no", "pay_method", "points_earned", "points_redeemed", "receivable", "received", "self_pay_amount", "sold_at", "staff_id", "status" FROM "sale_order";
DROP TABLE "sale_order";
ALTER TABLE "new_sale_order" RENAME TO "sale_order";
CREATE UNIQUE INDEX "sale_order_order_no_key" ON "sale_order"("order_no");
CREATE TABLE "new_stocktake" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "take_no" TEXT NOT NULL,
    "scope" TEXT,
    "base_time" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT '进行中',
    "initiated_by" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    "take_mode" TEXT NOT NULL DEFAULT '动态盘点',
    "finished_at" DATETIME,
    "approved_at" DATETIME,
    CONSTRAINT "stocktake_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stocktake_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_stocktake" ("base_time", "id", "initiated_by", "reviewed_by", "scope", "status", "take_no") SELECT "base_time", "id", "initiated_by", "reviewed_by", "scope", "status", "take_no" FROM "stocktake";
DROP TABLE "stocktake";
ALTER TABLE "new_stocktake" RENAME TO "stocktake";
CREATE UNIQUE INDEX "stocktake_take_no_key" ON "stocktake"("take_no");
CREATE TABLE "new_stocktake_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stocktake_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "book_qty" INTEGER NOT NULL,
    "counted_qty" INTEGER NOT NULL DEFAULT 0,
    "actual_qty" INTEGER NOT NULL,
    "diff_qty" INTEGER NOT NULL,
    "diff_amount" DECIMAL NOT NULL,
    "pending_entry" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "stocktake_item_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "stocktake" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stocktake_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "drug_batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_stocktake_item" ("actual_qty", "batch_id", "book_qty", "diff_amount", "diff_qty", "id", "pending_entry", "stocktake_id") SELECT "actual_qty", "batch_id", "book_qty", "diff_amount", "diff_qty", "id", "pending_entry", "stocktake_id" FROM "stocktake_item";
DROP TABLE "stocktake_item";
ALTER TABLE "new_stocktake_item" RENAME TO "stocktake_item";
CREATE UNIQUE INDEX "stocktake_item_stocktake_id_batch_id_key" ON "stocktake_item"("stocktake_id", "batch_id");
CREATE TABLE "new_trace_record" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trace_code_id" INTEGER NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL DEFAULT '入库',
    "batch_id" INTEGER,
    "scanned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sale_item_id" INTEGER,
    "sync_status" TEXT NOT NULL DEFAULT '已同步',
    "synced_at" DATETIME,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "revokes_id" INTEGER,
    CONSTRAINT "trace_record_trace_code_id_fkey" FOREIGN KEY ("trace_code_id") REFERENCES "trace_code" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trace_record_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trace_record_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "drug_batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_trace_record" ("id", "sale_item_id", "scanned_at", "staff_id", "trace_code_id") SELECT "id", "sale_item_id", "scanned_at", "staff_id", "trace_code_id" FROM "trace_record";
DROP TABLE "trace_record";
ALTER TABLE "new_trace_record" RENAME TO "trace_record";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "reward_item_reward_code_key" ON "reward_item"("reward_code");
