-- Sprint 1: modelo completo (ver docs/specs/HU-Sprint-1.md).
-- Migración con preservación de datos:
--   * enum FormaPago -> tabla catálogo formas_pago (se mapean los valores existentes)
--   * enum DuracionTurno -> turnos.duracionMinutosTurno (UNA_HORA=60, DOS_HORAS=120, TRES_HORAS=180)
--   * profesores.fechaNacimientoProfesor (NOT NULL): nullable + backfill placeholder + NOT NULL

-- CreateEnum
CREATE TYPE "Genero" AS ENUM ('MASCULINO', 'FEMENINO', 'OTRO', 'PREFIERO_NO_INDICARLO');

-- CreateEnum
CREATE TYPE "TipoEventoSeguridad" AS ENUM ('LOGOUT', 'REGISTRO_CUENTA', 'VERIFICACION_CODIGO_EXITOSA', 'VERIFICACION_CODIGO_FALLIDA');

-- CreateTable
CREATE TABLE "formas_pago" (
    "idFormaPago" TEXT NOT NULL,
    "nombreFormaPago" TEXT NOT NULL,
    "activaFormaPago" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "formas_pago_pkey" PRIMARY KEY ("idFormaPago")
);

-- CreateIndex
CREATE UNIQUE INDEX "formas_pago_nombreFormaPago_key" ON "formas_pago"("nombreFormaPago");

-- Catálogo inicial (equivale a los valores del enum FormaPago anterior)
INSERT INTO "formas_pago" ("idFormaPago", "nombreFormaPago", "activaFormaPago") VALUES
    ('formapago-efectivo', 'Efectivo', true),
    ('formapago-transferencia', 'Transferencia', true),
    ('formapago-debito', 'Débito', true),
    ('formapago-mercado-pago', 'Mercado Pago', true);

-- DropForeignKey
ALTER TABLE "alumnos" DROP CONSTRAINT "alumnos_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "profesores" DROP CONSTRAINT "profesores_usuarioId_fkey";

-- AlterTable
ALTER TABLE "alumnos" ADD COLUMN     "activoAlumno" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "creadoPorUsuarioId" TEXT,
ADD COLUMN     "formaPagoPreferidaId" TEXT,
ADD COLUMN     "generoAlumno" "Genero",
ADD COLUMN     "modificadoPorUsuarioId" TEXT,
ADD COLUMN     "terminosAceptadosEn" TIMESTAMP(3),
ADD COLUMN     "versionTerminosAceptada" TEXT,
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- Conversión de datos: enum FormaPago -> FK al catálogo
UPDATE "alumnos" SET "formaPagoPreferidaId" = CASE "formaPagoPreferidaAlumno"::text
    WHEN 'EFECTIVO' THEN 'formapago-efectivo'
    WHEN 'TRANSFERENCIA' THEN 'formapago-transferencia'
    WHEN 'DEBITO' THEN 'formapago-debito'
    WHEN 'MERCADO_PAGO' THEN 'formapago-mercado-pago'
END;

-- AlterTable
ALTER TABLE "alumnos" DROP COLUMN "formaPagoPreferidaAlumno";

-- AlterTable
ALTER TABLE "aulas" ADD COLUMN     "activaAula" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "creadoPorUsuarioId" TEXT,
ADD COLUMN     "createdAtAula" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "horarios_profesor" ADD COLUMN     "creadoPorUsuarioId" TEXT,
ADD COLUMN     "createdAtHorario" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "materias" ADD COLUMN     "activaMateria" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "creadoPorUsuarioId" TEXT,
ADD COLUMN     "createdAtMateria" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable (fechaNacimientoProfesor: nullable + backfill + NOT NULL)
ALTER TABLE "profesores" ADD COLUMN     "activoProfesor" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "creadoPorUsuarioId" TEXT,
ADD COLUMN     "fechaNacimientoProfesor" DATE,
ADD COLUMN     "generoProfesor" "Genero",
ALTER COLUMN "usuarioId" DROP NOT NULL,
ALTER COLUMN "telefonoProfesor" DROP NOT NULL,
ALTER COLUMN "emailProfesor" DROP NOT NULL;

-- Backfill de filas existentes (placeholder)
UPDATE "profesores" SET "fechaNacimientoProfesor" = DATE '2000-01-01' WHERE "fechaNacimientoProfesor" IS NULL;

-- AlterTable
ALTER TABLE "profesores" ALTER COLUMN "fechaNacimientoProfesor" SET NOT NULL;

-- AlterTable (duracionMinutosTurno: nullable + conversión desde el enum + NOT NULL)
ALTER TABLE "turnos" ADD COLUMN     "creadoPorUsuarioId" TEXT,
ADD COLUMN     "duracionMinutosTurno" INTEGER;

UPDATE "turnos" SET "duracionMinutosTurno" = CASE "duracionTurno"::text
    WHEN 'UNA_HORA' THEN 60
    WHEN 'DOS_HORAS' THEN 120
    WHEN 'TRES_HORAS' THEN 180
END;

ALTER TABLE "turnos" ALTER COLUMN "duracionMinutosTurno" SET NOT NULL,
DROP COLUMN "duracionTurno";

-- DropEnum
DROP TYPE "DuracionTurno";

-- DropEnum
DROP TYPE "FormaPago";

-- CreateTable
CREATE TABLE "tokens_revocados" (
    "jti" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tokens_revocados_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "intentos_login_fallidos" (
    "idIntento" TEXT NOT NULL,
    "emailIntento" TEXT NOT NULL,
    "ipIntento" TEXT NOT NULL,
    "creadoEnIntento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentos_login_fallidos_pkey" PRIMARY KEY ("idIntento")
);

-- CreateTable
CREATE TABLE "intentos_registro" (
    "idIntentoRegistro" TEXT NOT NULL,
    "ipIntentoRegistro" TEXT NOT NULL,
    "creadoEnIntentoRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentos_registro_pkey" PRIMARY KEY ("idIntentoRegistro")
);

-- CreateTable
CREATE TABLE "eventos_seguridad" (
    "idEvento" TEXT NOT NULL,
    "tipoEvento" "TipoEventoSeguridad" NOT NULL,
    "usuarioId" TEXT,
    "emailEvento" TEXT,
    "ipEvento" TEXT NOT NULL,
    "creadoEnEvento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_seguridad_pkey" PRIMARY KEY ("idEvento")
);

-- CreateTable
CREATE TABLE "codigos_verificacion" (
    "idCodigo" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "invalidadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_verificacion_pkey" PRIMARY KEY ("idCodigo")
);

-- CreateTable
CREATE TABLE "parametros_sistema" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "parametros_sistema_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "intentos_login_fallidos_emailIntento_creadoEnIntento_idx" ON "intentos_login_fallidos"("emailIntento", "creadoEnIntento");

-- CreateIndex
CREATE INDEX "intentos_registro_ipIntentoRegistro_creadoEnIntentoRegistro_idx" ON "intentos_registro"("ipIntentoRegistro", "creadoEnIntentoRegistro");

-- CreateIndex
CREATE INDEX "eventos_seguridad_creadoEnEvento_idx" ON "eventos_seguridad"("creadoEnEvento");

-- AddForeignKey
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("idUsuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_formaPagoPreferidaId_fkey" FOREIGN KEY ("formaPagoPreferidaId") REFERENCES "formas_pago"("idFormaPago") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_verificacion" ADD CONSTRAINT "codigos_verificacion_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "alumnos"("idAlumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesores" ADD CONSTRAINT "profesores_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("idUsuario") ON DELETE SET NULL ON UPDATE CASCADE;
