-- AlterTable
ALTER TABLE "ChallengeCheckIn" ADD COLUMN     "frozen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ChallengeParticipant" ADD COLUMN     "freezesAvailable" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ChallengeMessage" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChallengeMessage_challengeId_createdAt_idx" ON "ChallengeMessage"("challengeId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChallengeMessage" ADD CONSTRAINT "ChallengeMessage_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeMessage" ADD CONSTRAINT "ChallengeMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
