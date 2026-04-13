/*
  Warnings:

  - Added the required column `audience` to the `AccessCode` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AccessCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "email" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "notes" TEXT,
    "audience" TEXT NOT NULL
);
INSERT INTO "new_AccessCode" ("code", "email", "expiresAt", "id", "maxUses", "notes", "usedCount", "audience") SELECT "code", "email", "expiresAt", "id", "maxUses", "notes", "usedCount", 'STUDENT' FROM "AccessCode";
DROP TABLE "AccessCode";
ALTER TABLE "new_AccessCode" RENAME TO "AccessCode";
CREATE UNIQUE INDEX "AccessCode_code_key" ON "AccessCode"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
