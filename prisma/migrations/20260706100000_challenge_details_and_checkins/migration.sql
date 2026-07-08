-- CreateEnum
CREATE TYPE "ChallengeCategory" AS ENUM ('MEAL', 'WORKOUT', 'STEPS', 'WATER', 'MEDITATION', 'RECIPE', 'GYM_PROGRESS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ChallengeDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "Challenge"
  ADD COLUMN "category" "ChallengeCategory" NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN "difficulty" "ChallengeDifficulty" NOT NULL DEFAULT 'BEGINNER',
  ADD COLUMN "coverImageUrl" TEXT,
  ADD COLUMN "rules" TEXT,
  ADD COLUMN "rewardText" TEXT;

-- CreateTable
CREATE TABLE "ChallengeCheckIn" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeCheckIn_challengeId_userId_date_key" ON "ChallengeCheckIn"("challengeId", "userId", "date");

-- AddForeignKey
ALTER TABLE "ChallengeCheckIn" ADD CONSTRAINT "ChallengeCheckIn_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeCheckIn" ADD CONSTRAINT "ChallengeCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
