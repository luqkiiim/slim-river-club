CREATE TABLE "MonthPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "requiredTargetPct" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "MonthPolicy_month_year_key" ON "MonthPolicy"("month", "year");
CREATE INDEX "MonthPolicy_year_month_idx" ON "MonthPolicy"("year", "month");

ALTER TABLE "MonthlyResult" ADD COLUMN "requiredLossKg" REAL NOT NULL DEFAULT 0;
ALTER TABLE "MonthlyResult" ADD COLUMN "targetRatioPct" INTEGER NOT NULL DEFAULT 100;
