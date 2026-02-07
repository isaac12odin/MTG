-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MOD';

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenById" TEXT,
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserSecurity" ADD COLUMN     "manualVerificationNotes" TEXT,
ADD COLUMN     "manualVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "manualVerifiedById" TEXT;

-- CreateTable
CREATE TABLE "UserReputation" (
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "sellerScore" INTEGER NOT NULL DEFAULT 0,
    "buyerScore" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "positiveCount" INTEGER NOT NULL DEFAULT 0,
    "negativeCount" INTEGER NOT NULL DEFAULT 0,
    "completedSales" INTEGER NOT NULL DEFAULT 0,
    "completedBuys" INTEGER NOT NULL DEFAULT 0,
    "unpaidCount" INTEGER NOT NULL DEFAULT 0,
    "disputeCount" INTEGER NOT NULL DEFAULT 0,
    "sellerRank" INTEGER,
    "buyerRank" INTEGER,
    "lastCalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserReputation_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "UserReputation_score_idx" ON "UserReputation"("score");

-- CreateIndex
CREATE INDEX "UserReputation_sellerScore_idx" ON "UserReputation"("sellerScore");

-- CreateIndex
CREATE INDEX "UserReputation_buyerScore_idx" ON "UserReputation"("buyerScore");

-- CreateIndex
CREATE INDEX "Review_hiddenById_idx" ON "Review"("hiddenById");

-- AddForeignKey
ALTER TABLE "UserReputation" ADD CONSTRAINT "UserReputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSecurity" ADD CONSTRAINT "UserSecurity_manualVerifiedById_fkey" FOREIGN KEY ("manualVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
