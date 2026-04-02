-- CreateTable
CREATE TABLE "BulletinSummary" (
    "id" TEXT NOT NULL,
    "bulletinId" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "prompt" TEXT NOT NULL,
    "calledAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulletinSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulletinSummary_bulletinId_idx" ON "BulletinSummary"("bulletinId");

-- AddForeignKey
ALTER TABLE "BulletinSummary" ADD CONSTRAINT "BulletinSummary_bulletinId_fkey" FOREIGN KEY ("bulletinId") REFERENCES "Bulletin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing summary data into the new table
INSERT INTO "BulletinSummary" ("id", "bulletinId", "summary", "prompt", "calledAt", "durationMs", "statusCode", "inputTokens", "outputTokens", "createdAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "summary",
    '',
    "fetchedAt",
    0,
    200,
    0,
    0,
    "fetchedAt"
FROM "Bulletin"
WHERE "summary" IS NOT NULL AND "summary"::text != '{}';

-- DropColumn
ALTER TABLE "Bulletin" DROP COLUMN "summary";
