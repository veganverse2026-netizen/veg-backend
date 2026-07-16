-- AlterTable
ALTER TABLE "User" ADD COLUMN     "carbsTargetOverride" INTEGER,
ADD COLUMN     "fatTargetOverride" INTEGER,
ADD COLUMN     "goalSetAt" TIMESTAMP(3),
ADD COLUMN     "goalStartWeightKg" DOUBLE PRECISION,
ADD COLUMN     "goalTargetDate" TIMESTAMP(3),
ADD COLUMN     "goalTargetWeightKg" DOUBLE PRECISION,
ADD COLUMN     "goalTimelineWeeks" INTEGER;
