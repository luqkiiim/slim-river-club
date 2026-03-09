PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "claimCode" TEXT,
    "startWeight" REAL,
    "targetWeight" REAL,
    "goalReached" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isParticipant" BOOLEAN NOT NULL DEFAULT true,
    "totalRmOwed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_User" (
    "id",
    "name",
    "email",
    "passwordHash",
    "claimCode",
    "startWeight",
    "targetWeight",
    "goalReached",
    "isAdmin",
    "isParticipant",
    "totalRmOwed",
    "createdAt"
)
SELECT
    "id",
    "name",
    "email",
    "passwordHash",
    CASE
        WHEN "passwordHash" IS NULL AND "isParticipant" = true THEN upper(hex(randomblob(4)))
        ELSE NULL
    END,
    "startWeight",
    "targetWeight",
    "goalReached",
    "isAdmin",
    "isParticipant",
    "totalRmOwed",
    "createdAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_claimCode_key" ON "User"("claimCode");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
