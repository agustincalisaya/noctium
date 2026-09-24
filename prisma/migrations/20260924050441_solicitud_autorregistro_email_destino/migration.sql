/*
  Warnings:

  - Added the required column `emailDestino` to the `solicitudes_autorregistro` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "solicitudes_autorregistro" ADD COLUMN     "emailDestino" TEXT NOT NULL;
