-- AlterTable: streak freezes
ALTER TABLE "User" ADD COLUMN     "streakFreezesAvailable" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "streakFreezesResetAt" TIMESTAMP(3);

-- AlterTable: referrals (nullable first — backfilled below before NOT NULL is enforced)
ALTER TABLE "User" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" TEXT;

-- Backfill: existing rows have no code yet. Hand-written (not prisma-generated)
-- because `prisma migrate dev` correctly refuses to add a required+unique
-- column to a table with existing rows non-interactively — see the 25-row
-- User table this ran against on 2026-08-29.
UPDATE "User" SET "referralCode" = substr(md5(random()::text || id), 1, 8)
WHERE "referralCode" IS NULL;

ALTER TABLE "User" ALTER COLUMN "referralCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Streak freeze marker
ALTER TABLE "Streak" ADD COLUMN     "frozen" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeKey_key" ON "UserBadge"("userId", "badgeKey");

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
