-- CreateTable
CREATE TABLE "ScannedProductCache" (
    "barcode" TEXT NOT NULL,
    "productName" TEXT,
    "brand" TEXT,
    "imageUrl" TEXT,
    "ingredientsText" TEXT,
    "verdict" TEXT NOT NULL,
    "citedIngredients" JSONB NOT NULL,
    "verdictSource" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScannedProductCache_pkey" PRIMARY KEY ("barcode")
);

-- CreateTable
CREATE TABLE "UserProductScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProductScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserProductScan_userId_scannedAt_idx" ON "UserProductScan"("userId", "scannedAt");

-- AddForeignKey
ALTER TABLE "UserProductScan" ADD CONSTRAINT "UserProductScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProductScan" ADD CONSTRAINT "UserProductScan_barcode_fkey" FOREIGN KEY ("barcode") REFERENCES "ScannedProductCache"("barcode") ON DELETE CASCADE ON UPDATE CASCADE;
