/*
  Warnings:

  - Made the column `apellidoNormalizadoAlumno` on table `alumnos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `nombreNormalizadoAlumno` on table `alumnos` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "alumnos" ALTER COLUMN "apellidoNormalizadoAlumno" SET NOT NULL,
ALTER COLUMN "nombreNormalizadoAlumno" SET NOT NULL;
