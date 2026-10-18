-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sale_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sale_order_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL,
    "is_gift" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "sale_item_sale_order_id_fkey" FOREIGN KEY ("sale_order_id") REFERENCES "sale_order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sale_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "drug_batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_sale_item" ("amount", "batch_id", "id", "quantity", "sale_order_id", "unit_price") SELECT "amount", "batch_id", "id", "quantity", "sale_order_id", "unit_price" FROM "sale_item";
DROP TABLE "sale_item";
ALTER TABLE "new_sale_item" RENAME TO "sale_item";
CREATE TABLE "new_sale_order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_no" TEXT NOT NULL,
    "member_id" INTEGER,
    "staff_id" INTEGER NOT NULL,
    "sold_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivable" DECIMAL NOT NULL,
    "received" DECIMAL NOT NULL,
    "pay_method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '已完成',
    "is_member_price" BOOLEAN NOT NULL DEFAULT false,
    "points_earned" INTEGER NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL NOT NULL DEFAULT 0,
    "points_redeemed" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "sale_order_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sale_order_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_sale_order" ("id", "is_member_price", "member_id", "order_no", "pay_method", "points_earned", "receivable", "received", "sold_at", "staff_id", "status") SELECT "id", "is_member_price", "member_id", "order_no", "pay_method", "points_earned", "receivable", "received", "sold_at", "staff_id", "status" FROM "sale_order";
DROP TABLE "sale_order";
ALTER TABLE "new_sale_order" RENAME TO "sale_order";
CREATE UNIQUE INDEX "sale_order_order_no_key" ON "sale_order"("order_no");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
