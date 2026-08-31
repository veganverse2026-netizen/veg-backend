-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adaptiveCalorieTarget" INTEGER,
ADD COLUMN     "adaptiveCarbsTarget" INTEGER,
ADD COLUMN     "adaptiveFatTarget" INTEGER,
ADD COLUMN     "adaptiveProteinTarget" INTEGER,
ADD COLUMN     "adaptiveTargetNote" TEXT,
ADD COLUMN     "adaptiveTargetUpdatedAt" TIMESTAMP(3);
