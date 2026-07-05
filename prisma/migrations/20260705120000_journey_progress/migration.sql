-- CreateTable
CREATE TABLE "JourneyProgress" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JourneyProgress_key_key" ON "JourneyProgress"("key");
