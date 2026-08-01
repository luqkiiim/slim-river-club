CREATE TABLE "UserMonthlyTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "monthlyLossTargetKg" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserMonthlyTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserMonthlyTarget_userId_month_year_key" ON "UserMonthlyTarget"("userId", "month", "year");
CREATE INDEX "UserMonthlyTarget_userId_year_month_idx" ON "UserMonthlyTarget"("userId", "year", "month");
