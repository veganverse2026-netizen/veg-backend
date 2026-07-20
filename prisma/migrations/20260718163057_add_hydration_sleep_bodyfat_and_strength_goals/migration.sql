-- AlterTable
ALTER TABLE "Tracker" ADD COLUMN     "bodyFatPercent" DOUBLE PRECISION,
ADD COLUMN     "hydrationMl" INTEGER,
ADD COLUMN     "sleepHours" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "StrengthGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "targetWeightKg" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrengthGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StrengthGoal_userId_exercise_key" ON "StrengthGoal"("userId", "exercise");

-- AddForeignKey
ALTER TABLE "StrengthGoal" ADD CONSTRAINT "StrengthGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
