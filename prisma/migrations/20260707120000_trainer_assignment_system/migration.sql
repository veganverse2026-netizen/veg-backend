-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GymTrainer"
  ADD COLUMN "certifications" TEXT,
  ADD COLUMN "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "yearsExperience" INTEGER,
  ADD COLUMN "workingHours" TEXT,
  ADD COLUMN "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
