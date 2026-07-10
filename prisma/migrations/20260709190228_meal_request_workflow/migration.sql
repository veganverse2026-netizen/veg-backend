-- AlterTable
ALTER TABLE "MealPlanChangeRequest" ADD COLUMN     "contextJson" TEXT,
ADD COLUMN     "requestType" TEXT NOT NULL DEFAULT 'FULL_PLAN',
ADD COLUMN     "wasModified" BOOLEAN NOT NULL DEFAULT false;
