-- AddColumns
ALTER TABLE "Question" ADD COLUMN "promptHtml" TEXT;
ALTER TABLE "Question" ADD COLUMN "optionsHtml" JSONB;
