-- CreateTable
CREATE TABLE "TrainerProductBundle" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerProductBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerProductBundleItem" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "TrainerProductBundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainerProductBundle_memberId_idx" ON "TrainerProductBundle"("memberId");

-- CreateIndex
CREATE INDEX "TrainerProductBundle_trainerId_idx" ON "TrainerProductBundle"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerProductBundleItem_bundleId_productId_key" ON "TrainerProductBundleItem"("bundleId", "productId");

-- AddForeignKey
ALTER TABLE "TrainerProductBundle" ADD CONSTRAINT "TrainerProductBundle_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "GymTrainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProductBundle" ADD CONSTRAINT "TrainerProductBundle_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProductBundleItem" ADD CONSTRAINT "TrainerProductBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "TrainerProductBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProductBundleItem" ADD CONSTRAINT "TrainerProductBundleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
