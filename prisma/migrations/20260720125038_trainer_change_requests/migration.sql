-- CreateEnum
CREATE TYPE "TrainerChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "TrainerChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "preferredRequirements" TEXT,
    "status" "TrainerChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "previousTrainerId" TEXT,
    "newTrainerId" TEXT,
    "adminComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainerChangeRequest_userId_idx" ON "TrainerChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "TrainerChangeRequest_status_idx" ON "TrainerChangeRequest"("status");

-- AddForeignKey
ALTER TABLE "TrainerChangeRequest" ADD CONSTRAINT "TrainerChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
