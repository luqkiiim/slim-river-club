CREATE TABLE "UserMonthPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "requiredTargetPct" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserMonthPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserMonthPolicy_userId_month_year_key" ON "UserMonthPolicy"("userId", "month", "year");
CREATE INDEX "UserMonthPolicy_year_month_idx" ON "UserMonthPolicy"("year", "month");
CREATE INDEX "UserMonthPolicy_userId_idx" ON "UserMonthPolicy"("userId");
