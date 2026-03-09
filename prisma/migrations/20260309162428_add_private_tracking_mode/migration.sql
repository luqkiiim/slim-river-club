-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MonthlyResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "startWeight" REAL,
    "endWeight" REAL,
    "weightLoss" REAL NOT NULL,
    "penaltyApplied" BOOLEAN NOT NULL,
    CONSTRAINT "MonthlyResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MonthlyResult" ("endWeight", "id", "month", "penaltyApplied", "startWeight", "userId", "weightLoss", "year") SELECT "endWeight", "id", "month", "penaltyApplied", "startWeight", "userId", "weightLoss", "year" FROM "MonthlyResult";
DROP TABLE "MonthlyResult";
ALTER TABLE "new_MonthlyResult" RENAME TO "MonthlyResult";
CREATE INDEX "MonthlyResult_year_month_idx" ON "MonthlyResult"("year", "month");
CREATE UNIQUE INDEX "MonthlyResult_userId_month_year_key" ON "MonthlyResult"("userId", "month", "year");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "claimCode" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "startWeight" REAL,
    "targetWeight" REAL,
    "targetLossKg" REAL,
    "goalReached" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isParticipant" BOOLEAN NOT NULL DEFAULT true,
    "totalRmOwed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("claimCode", "createdAt", "email", "goalReached", "id", "isAdmin", "isParticipant", "name", "passwordHash", "startWeight", "targetWeight", "totalRmOwed") SELECT "claimCode", "createdAt", "email", "goalReached", "id", "isAdmin", "isParticipant", "name", "passwordHash", "startWeight", "targetWeight", "totalRmOwed" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_claimCode_key" ON "User"("claimCode");
CREATE TABLE "new_WeightEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL DEFAULT 'ABSOLUTE',
    "weight" REAL,
    "lossKg" REAL,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeightEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WeightEntry" ("createdAt", "date", "id", "userId", "weight") SELECT "createdAt", "date", "id", "userId", "weight" FROM "WeightEntry";
DROP TABLE "WeightEntry";
ALTER TABLE "new_WeightEntry" RENAME TO "WeightEntry";
CREATE INDEX "WeightEntry_userId_date_idx" ON "WeightEntry"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
