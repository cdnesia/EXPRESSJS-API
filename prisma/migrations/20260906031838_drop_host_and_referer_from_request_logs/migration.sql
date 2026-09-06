/*
  Warnings:

  - You are about to drop the column `host` on the `request_logs` table. All the data in the column will be lost.
  - You are about to drop the column `referer` on the `request_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `request_logs` DROP COLUMN `host`,
    DROP COLUMN `referer`;
