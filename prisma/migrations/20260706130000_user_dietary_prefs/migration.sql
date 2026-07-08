-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "dietaryStyle" TEXT,
  ADD COLUMN "dietaryPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[];
