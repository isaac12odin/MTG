-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'BANNED');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE';
