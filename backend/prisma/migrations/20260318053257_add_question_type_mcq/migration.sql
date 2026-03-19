-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "finalAnswer" TEXT NOT NULL,
    "difficulty" TEXT,
    "type" TEXT NOT NULL DEFAULT 'FREE_FORM',
    "optionsJson" JSONB,
    "correctOptionIndex" INTEGER,
    "stepsJson" JSONB NOT NULL
);
INSERT INTO "new_Question" ("difficulty", "finalAnswer", "id", "prompt", "stepsJson", "topic") SELECT "difficulty", "finalAnswer", "id", "prompt", "stepsJson", "topic" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
