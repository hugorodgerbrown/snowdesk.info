-- CreateTable
CREATE TABLE "Bulletin" (
    "id" TEXT NOT NULL,
    "bulletinId" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "regionIds" TEXT[],
    "regionNames" TEXT[],
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "nextUpdate" TIMESTAMP(3),
    "lang" TEXT NOT NULL DEFAULT 'en',
    "unscheduled" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bulletin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bulletin_bulletinId_key" ON "Bulletin"("bulletinId");

-- CreateIndex
CREATE INDEX "Bulletin_fetchedAt_idx" ON "Bulletin"("fetchedAt");

-- CreateIndex
CREATE INDEX "Bulletin_issuedAt_idx" ON "Bulletin"("issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bulletin_bulletinId_issuedAt_key" ON "Bulletin"("bulletinId", "issuedAt");
