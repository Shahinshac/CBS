-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;
