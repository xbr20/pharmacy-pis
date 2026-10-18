-- CreateTable
CREATE TABLE "admin_user" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '管理员',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "drug" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "drug_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "manufacturer" TEXT,
    "is_prescription" BOOLEAN NOT NULL DEFAULT false,
    "in_medical_insurance" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "disposal_rule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rule_code" TEXT NOT NULL,
    "drug_id" INTEGER,
    "category" TEXT,
    "expiry_days" INTEGER NOT NULL,
    "suggested_action" TEXT NOT NULL,
    "need_approval" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "disposal_rule_drug_id_fkey" FOREIGN KEY ("drug_id") REFERENCES "drug" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "member_level" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level_name" TEXT NOT NULL,
    "discount_rate" DECIMAL NOT NULL,
    "point_rate" DECIMAL NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "trace_code" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "drug_id" INTEGER NOT NULL,
    "batch_no" TEXT NOT NULL,
    "manufacturer" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "trace_code_drug_id_fkey" FOREIGN KEY ("drug_id") REFERENCES "drug" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "storage_location" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "location_code" TEXT NOT NULL,
    "shelf_no" TEXT,
    "cabinet_no" TEXT,
    "storage_condition" TEXT
);

-- CreateTable
CREATE TABLE "drug_batch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "drug_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "batch_no" TEXT NOT NULL,
    "expire_date" DATETIME NOT NULL,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "batch_status" TEXT NOT NULL DEFAULT '在库',
    "flow_status" TEXT NOT NULL DEFAULT '正常',
    CONSTRAINT "drug_batch_drug_id_fkey" FOREIGN KEY ("drug_id") REFERENCES "drug" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "drug_batch_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "storage_location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "staff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employee_no" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "post" TEXT NOT NULL,
    "pharmacist_no" TEXT,
    "pharmacist_expire" DATETIME,
    "hired_date" DATETIME
);

-- CreateTable
CREATE TABLE "member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "card_no" TEXT NOT NULL,
    "level_id" INTEGER NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "birth_date" DATETIME,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "health_note" TEXT,
    CONSTRAINT "member_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "member_level" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staff_id" INTEGER NOT NULL,
    "work_date" DATETIME NOT NULL,
    "time_range" TEXT NOT NULL,
    "shift_no" TEXT NOT NULL,
    CONSTRAINT "shift_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trace_record" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trace_code_id" INTEGER NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "scanned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sale_item_id" INTEGER,
    CONSTRAINT "trace_record_trace_code_id_fkey" FOREIGN KEY ("trace_code_id") REFERENCES "trace_code" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trace_record_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prescription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rx_no" TEXT NOT NULL,
    "staff_id" INTEGER,
    "doctor_name" TEXT NOT NULL,
    "rx_date" DATETIME NOT NULL,
    "auto_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" DATETIME,
    CONSTRAINT "prescription_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prescription_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prescription_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "dosage" TEXT NOT NULL,
    CONSTRAINT "prescription_item_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescription" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "prescription_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "drug_batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sale_order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_no" TEXT NOT NULL,
    "member_id" INTEGER,
    "staff_id" INTEGER NOT NULL,
    "sold_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivable" DECIMAL NOT NULL,
    "received" DECIMAL NOT NULL,
    "pay_method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '已完成',
    CONSTRAINT "sale_order_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sale_order_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sale_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sale_order_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL,
    CONSTRAINT "sale_item_sale_order_id_fkey" FOREIGN KEY ("sale_order_id") REFERENCES "sale_order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sale_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "drug_batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "expiry_disposal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batch_id" INTEGER NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "disposed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviation_note" TEXT,
    "apply_no" TEXT,
    CONSTRAINT "expiry_disposal_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "drug_batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "expiry_disposal_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stocktake" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "take_no" TEXT NOT NULL,
    "scope" TEXT,
    "base_time" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT '进行中',
    "initiated_by" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    CONSTRAINT "stocktake_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stocktake_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stocktake_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stocktake_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "book_qty" INTEGER NOT NULL,
    "actual_qty" INTEGER NOT NULL,
    "diff_qty" INTEGER NOT NULL,
    "diff_amount" DECIMAL NOT NULL,
    "pending_entry" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "stocktake_item_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "stocktake" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stocktake_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "drug_batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_username_key" ON "admin_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "drug_drug_code_key" ON "drug"("drug_code");

-- CreateIndex
CREATE UNIQUE INDEX "disposal_rule_rule_code_key" ON "disposal_rule"("rule_code");

-- CreateIndex
CREATE UNIQUE INDEX "member_level_level_name_key" ON "member_level"("level_name");

-- CreateIndex
CREATE UNIQUE INDEX "trace_code_code_key" ON "trace_code"("code");

-- CreateIndex
CREATE UNIQUE INDEX "storage_location_location_code_key" ON "storage_location"("location_code");

-- CreateIndex
CREATE UNIQUE INDEX "drug_batch_drug_id_batch_no_key" ON "drug_batch"("drug_id", "batch_no");

-- CreateIndex
CREATE UNIQUE INDEX "staff_employee_no_key" ON "staff"("employee_no");

-- CreateIndex
CREATE UNIQUE INDEX "member_card_no_key" ON "member"("card_no");

-- CreateIndex
CREATE UNIQUE INDEX "shift_staff_id_work_date_shift_no_key" ON "shift"("staff_id", "work_date", "shift_no");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_rx_no_key" ON "prescription"("rx_no");

-- CreateIndex
CREATE UNIQUE INDEX "sale_order_order_no_key" ON "sale_order"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "stocktake_take_no_key" ON "stocktake"("take_no");
