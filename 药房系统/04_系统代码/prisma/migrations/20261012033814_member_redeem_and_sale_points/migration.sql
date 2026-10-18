-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_member_level" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level_name" TEXT NOT NULL,
    "discount_rate" DECIMAL NOT NULL,
    "point_rate" DECIMAL NOT NULL DEFAULT 1,
    "redeem_threshold" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_member_level" ("discount_rate", "id", "level_name", "point_rate") SELECT "discount_rate", "id", "level_name", "point_rate" FROM "member_level";
DROP TABLE "member_level";
ALTER TABLE "new_member_level" RENAME TO "member_level";
CREATE UNIQUE INDEX "member_level_level_name_key" ON "member_level"("level_name");
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
    CONSTRAINT "sale_order_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sale_order_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_sale_order" ("id", "member_id", "order_no", "pay_method", "receivable", "received", "sold_at", "staff_id", "status") SELECT "id", "member_id", "order_no", "pay_method", "receivable", "received", "sold_at", "staff_id", "status" FROM "sale_order";
DROP TABLE "sale_order";
ALTER TABLE "new_sale_order" RENAME TO "sale_order";
CREATE UNIQUE INDEX "sale_order_order_no_key" ON "sale_order"("order_no");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
