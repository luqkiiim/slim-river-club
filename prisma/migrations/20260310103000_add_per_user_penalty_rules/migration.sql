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
    "penaltyExempt" BOOLEAN NOT NULL DEFAULT false,
    "penaltyAmountRm" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MonthlyResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_MonthlyResult" (
    "endWeight",
    "id",
    "month",
    "penaltyApplied",
    "penaltyExempt",
    "penaltyAmountRm",
    "startWeight",
    "userId",
    "weightLoss",
    "year"
)
SELECT
    "endWeight",
    "id",
    "month",
    "penaltyApplied",
    false,
    CASE
        WHEN "penaltyApplied" THEN 30
        ELSE 0
    END,
    "startWeight",
    "userId",
    "weightLoss",
    "year"
FROM "MonthlyResult";

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
    "monthlyLossTargetKg" REAL NOT NULL DEFAULT 2,
    "monthlyPenaltyRm" INTEGER NOT NULL DEFAULT 30,
    "challengeStartDate" DATETIME,
    "goalReached" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isParticipant" BOOLEAN NOT NULL DEFAULT true,
    "totalRmOwed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_User" (
    "claimCode",
    "challengeStartDate",
    "createdAt",
    "email",
    "goalReached",
    "id",
    "isAdmin",
    "isParticipant",
    "isPrivate",
    "monthlyLossTargetKg",
    "monthlyPenaltyRm",
    "name",
    "passwordHash",
    "startWeight",
    "targetLossKg",
    "targetWeight",
    "totalRmOwed"
)
SELECT
    "User"."claimCode",
    COALESCE(
        (
            SELECT MIN("WeightEntry"."date")
            FROM "WeightEntry"
            WHERE "WeightEntry"."userId" = "User"."id"
        ),
        "User"."createdAt"
    ),
    "User"."createdAt",
    "User"."email",
    "User"."goalReached",
    "User"."id",
    "User"."isAdmin",
    "User"."isParticipant",
    "User"."isPrivate",
    "User"."monthlyLossTargetKg",
    30,
    "User"."name",
    "User"."passwordHash",
    "User"."startWeight",
    "User"."targetLossKg",
    "User"."targetWeight",
    "User"."totalRmOwed"
FROM "User" AS "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_claimCode_key" ON "User"("claimCode");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
