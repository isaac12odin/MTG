-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('ACTIVE', 'RESERVED', 'SOLD', 'ARCHIVED');

-- AlterTable
ALTER TABLE "ListingItem" ADD COLUMN     "inventoryItemId" TEXT;

-- CreateTable
CREATE TABLE "StoreInventoryItem" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "condition" TEXT,
    "language" TEXT,
    "isFoil" BOOLEAN DEFAULT false,
    "price" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "status" "InventoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreInventoryItem_storeId_status_idx" ON "StoreInventoryItem"("storeId", "status");

-- CreateIndex
CREATE INDEX "StoreInventoryItem_cardId_idx" ON "StoreInventoryItem"("cardId");

-- CreateIndex
CREATE INDEX "ListingItem_inventoryItemId_idx" ON "ListingItem"("inventoryItemId");

-- AddForeignKey
ALTER TABLE "StoreInventoryItem" ADD CONSTRAINT "StoreInventoryItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInventoryItem" ADD CONSTRAINT "StoreInventoryItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CardDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingItem" ADD CONSTRAINT "ListingItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "StoreInventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
