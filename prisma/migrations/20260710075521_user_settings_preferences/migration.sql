-- CreateEnum
CREATE TYPE "UnitPreference" AS ENUM ('METRIC', 'IMPERIAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "notificationPrefs" JSONB,
ADD COLUMN     "unitPreference" "UnitPreference" NOT NULL DEFAULT 'METRIC';
