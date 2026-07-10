-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mealPlanJson" TEXT;

-- CreateTable
CREATE TABLE "MealLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slot" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "calories" INTEGER NOT NULL DEFAULT 0,
    "protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fiber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waterMl" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MealLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gymTrainerId" TEXT NOT NULL,
    "status" "PlanChangeStatus" NOT NULL DEFAULT 'PENDING',
    "memberNote" TEXT,
    "proposedPlanJson" TEXT NOT NULL,
    "trainerComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteMeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteMeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealLog_userId_date_idx" ON "MealLog"("userId", "date");

-- CreateIndex
CREATE INDEX "MealPlanChangeRequest_userId_createdAt_idx" ON "MealPlanChangeRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MealPlanChangeRequest_gymTrainerId_status_idx" ON "MealPlanChangeRequest"("gymTrainerId", "status");

-- CreateIndex
CREATE INDEX "FavoriteMeal_userId_idx" ON "FavoriteMeal"("userId");

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanChangeRequest" ADD CONSTRAINT "MealPlanChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanChangeRequest" ADD CONSTRAINT "MealPlanChangeRequest_gymTrainerId_fkey" FOREIGN KEY ("gymTrainerId") REFERENCES "GymTrainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteMeal" ADD CONSTRAINT "FavoriteMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
