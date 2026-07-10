-- CreateTable
CREATE TABLE "PostDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "PostType" NOT NULL DEFAULT 'QUESTION',
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostDraft_userId_idx" ON "PostDraft"("userId");

-- AddForeignKey
ALTER TABLE "PostDraft" ADD CONSTRAINT "PostDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
