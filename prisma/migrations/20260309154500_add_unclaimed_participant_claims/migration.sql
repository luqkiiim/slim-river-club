PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "claimToken" TEXT,
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
    "claimToken",
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
    NULL,
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
CREATE UNIQUE INDEX "User_claimToken_key" ON "User"("claimToken");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
