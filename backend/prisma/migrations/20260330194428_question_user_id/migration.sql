-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "finalAnswer" TEXT NOT NULL,
    "difficulty" TEXT,
    "userId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'FREE_FORM',
    "optionsJson" JSONB,
    "correctOptionIndex" INTEGER,
    "stepsJson" JSONB NOT NULL,
    CONSTRAINT "Question_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("correctOptionIndex", "difficulty", "finalAnswer", "id", "optionsJson", "prompt", "stepsJson", "topic", "type") SELECT "correctOptionIndex", "difficulty", "finalAnswer", "id", "optionsJson", "prompt", "stepsJson", "topic", "type" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE INDEX "Question_userId_topic_idx" ON "Question"("userId", "topic");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
