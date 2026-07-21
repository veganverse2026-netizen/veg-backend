-- CreateEnum
CREATE TYPE "WorkoutCompletionType" AS ENUM ('LOGGED', 'DONE');

-- CreateTable
CREATE TABLE "WorkoutCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "WorkoutCompletionType" NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutCompletion_userId_date_idx" ON "WorkoutCompletion"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutCompletion_userId_date_key" ON "WorkoutCompletion"("userId", "date");

-- AddForeignKey
ALTER TABLE "WorkoutCompletion" ADD CONSTRAINT "WorkoutCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
