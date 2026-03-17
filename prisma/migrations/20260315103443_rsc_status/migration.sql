/*
  Warnings:

  - You are about to drop the column `used` on the `ProjectResource` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProjectResource" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'backlog';

-- Data Migration
UPDATE "ProjectResource" SET "status" = 'core' WHERE "used" = true;

-- Drop Column
ALTER TABLE "ProjectResource" DROP COLUMN "used";
