-- ============================================================
-- Sprint 3 — PR 0, etapa 1: modelo del sprint (PR-0.md §2.1, §2.3–§2.8, §2.14)
--
-- Sin migración de datos (decisión del PO): se exige `prisma migrate reset` y
-- la base se regenera con el seed. La guarda de abajo aborta si alguna tabla
-- de negocio tiene filas.
--
-- Objetos SQL manuales (Prisma no los modela; `migrate diff` los ve como
-- diferencias y toda migración futura se revisa a mano para no borrarlos):
--   * índices únicos parciales: turno_alumno_vigente_key,
--     clases_dictadas_turno_no_anulada_key, cajas_abierta_por_integrante_key;
--   * CHECK de actor (USUARIO ⇔ usuario; PROCESO_AUTOMATICO ⇔ sin usuario),
--     de coherencia y de montos (ver cada tabla);
--   * secuencia comprobante_numero_seq;
--   * funciones y triggers de reservas_turno, ahora sobre inscripciones VIGENTE.
-- ============================================================
BEGIN;

-- Guarda de base vacía (PR-0.md §2.1).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "turno_alumno") OR EXISTS (SELECT 1 FROM "pagos")
     OR EXISTS (SELECT 1 FROM "turnos") OR EXISTS (SELECT 1 FROM "alumnos")
     OR EXISTS (SELECT 1 FROM "profesores") OR EXISTS (SELECT 1 FROM "materias")
     OR EXISTS (SELECT 1 FROM "aulas") THEN
    RAISE EXCEPTION 'Esta migración requiere una base vacía: corré `prisma migrate reset`';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "VigenciaInscripcion" AS ENUM ('VIGENTE', 'CANCELADA_ALUMNO', 'RESERVA_VENCIDA', 'BAJA_ALUMNO', 'QUITADA_CENTRO');

-- CreateEnum
CREATE TYPE "EstadoPagoInscripcion" AS ENUM ('RESERVADA', 'PAGADA', 'PAGO_SIN_REGISTRAR');

-- CreateEnum
CREATE TYPE "ActorTipo" AS ENUM ('USUARIO', 'PROCESO_AUTOMATICO');

-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PRESENTE', 'AUSENTE');

-- CreateEnum
CREATE TYPE "EntidadHistorialEstado" AS ENUM ('ALUMNO', 'PROFESOR', 'FICHA_MESA_ENTRADA', 'FICHA_GERENTE', 'FORMA_PAGO');

-- CreateEnum
CREATE TYPE "AccionHistorialEstado" AS ENUM ('DESACTIVAR', 'REACTIVAR');

-- DropIndex
DROP INDEX "clases_dictadas_turnoId_key";

-- AlterTable
ALTER TABLE "clases_dictadas" ADD COLUMN     "anuladaEl" TIMESTAMP(3),
ADD COLUMN     "anuladaPorUsuarioId" TEXT,
ADD COLUMN     "conControlAsistencia" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motivoAnulacion" VARCHAR(300);

-- AlterTable
ALTER TABLE "clases_dictadas_alumnos" ADD COLUMN     "estadoAsistencia" "EstadoAsistencia";

-- AlterTable
ALTER TABLE "formas_pago" ADD COLUMN     "esEfectivo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "materias" ADD COLUMN     "tarifaHoraMateria" INTEGER;

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "ajustadoPorUsuarioId" TEXT,
ADD COLUMN     "inscripcionId" TEXT NOT NULL,
ADD COLUMN     "motivoAjuste" VARCHAR(300),
ADD COLUMN     "operacionId" TEXT NOT NULL,
ADD COLUMN     "precio" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "turno_alumno" DROP CONSTRAINT "turno_alumno_pkey",
ADD COLUMN     "creadoPorUsuarioId" TEXT,
ADD COLUMN     "createdAtInscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "estadoPago" "EstadoPagoInscripcion" NOT NULL,
ADD COLUMN     "finalizadaEl" TIMESTAMP(3),
ADD COLUMN     "finalizadaPorActorTipo" "ActorTipo",
ADD COLUMN     "finalizadaPorUsuarioId" TEXT,
ADD COLUMN     "idInscripcion" TEXT NOT NULL,
ADD COLUMN     "inicioPlazo" TIMESTAMP(3),
ADD COLUMN     "precio" INTEGER NOT NULL,
ADD COLUMN     "reabiertaPorAnulacion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reservadaEl" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "venceBaseEl" TIMESTAMP(3),
ADD COLUMN     "venceEl" TIMESTAMP(3),
ADD COLUMN     "vigencia" "VigenciaInscripcion" NOT NULL DEFAULT 'VIGENTE',
ADD CONSTRAINT "turno_alumno_pkey" PRIMARY KEY ("idInscripcion");

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "debeCambiarPasswordUsuario" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sesionesValidasDesdeUsuario" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tokens_recuperacion" (
    "idTokenRecuperacion" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHashRecuperacion" TEXT NOT NULL,
    "venceEnToken" TIMESTAMP(3) NOT NULL,
    "consumidoEnToken" TIMESTAMP(3),
    "creadoEnToken" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacion_pkey" PRIMARY KEY ("idTokenRecuperacion")
);

-- CreateTable
CREATE TABLE "solicitudes_recuperacion" (
    "idSolicitudRecuperacion" TEXT NOT NULL,
    "emailSolicitud" TEXT NOT NULL,
    "ipSolicitud" TEXT NOT NULL,
    "creadoEnSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_recuperacion_pkey" PRIMARY KEY ("idSolicitudRecuperacion")
);

-- CreateTable
CREATE TABLE "historial_tarifas" (
    "idHistorialTarifa" TEXT NOT NULL,
    "materiaId" TEXT NOT NULL,
    "tarifaAnterior" INTEGER,
    "tarifaNueva" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "masivo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "historial_tarifas_pkey" PRIMARY KEY ("idHistorialTarifa")
);

-- CreateTable
CREATE TABLE "historial_inscripciones" (
    "idHistorialInscripcion" TEXT NOT NULL,
    "inscripcionId" TEXT NOT NULL,
    "vigenciaAnterior" "VigenciaInscripcion",
    "vigenciaNueva" "VigenciaInscripcion" NOT NULL,
    "estadoPagoAnterior" "EstadoPagoInscripcion",
    "estadoPagoNuevo" "EstadoPagoInscripcion" NOT NULL,
    "actorTipo" "ActorTipo" NOT NULL,
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historial_inscripciones_pkey" PRIMARY KEY ("idHistorialInscripcion")
);

-- CreateTable
CREATE TABLE "operaciones_pago" (
    "idOperacionPago" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "formaPagoId" TEXT NOT NULL,
    "fechaPago" DATE NOT NULL,
    "creadoPorUsuarioId" TEXT NOT NULL,
    "registradaEl" TIMESTAMP(3) NOT NULL,
    "cajaId" TEXT NOT NULL,

    CONSTRAINT "operaciones_pago_pkey" PRIMARY KEY ("idOperacionPago")
);

-- CreateTable
CREATE TABLE "correcciones_pago" (
    "idCorreccionPago" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "montoAnterior" DECIMAL(11,2) NOT NULL,
    "montoNuevo" DECIMAL(11,2) NOT NULL,
    "motivo" VARCHAR(300) NOT NULL,
    "creadoPorUsuarioId" TEXT NOT NULL,
    "createdAtCorreccionPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correcciones_pago_pkey" PRIMARY KEY ("idCorreccionPago")
);

-- CreateTable
CREATE TABLE "anulaciones_pago" (
    "idAnulacionPago" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "motivo" VARCHAR(300) NOT NULL,
    "actorTipo" "ActorTipo" NOT NULL DEFAULT 'USUARIO',
    "creadoPorUsuarioId" TEXT,
    "createdAtAnulacionPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anulaciones_pago_pkey" PRIMARY KEY ("idAnulacionPago")
);

-- CreateTable
CREATE TABLE "correcciones_operacion" (
    "idCorreccionOperacion" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "formaPagoAnteriorId" TEXT,
    "formaPagoNuevaId" TEXT,
    "fechaPagoAnterior" DATE,
    "fechaPagoNueva" DATE,
    "motivo" VARCHAR(300) NOT NULL,
    "creadoPorUsuarioId" TEXT NOT NULL,
    "createdAtCorreccionOperacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correcciones_operacion_pkey" PRIMARY KEY ("idCorreccionOperacion")
);

-- CreateTable
CREATE TABLE "comprobantes" (
    "idComprobante" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "operacionId" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "emitidoEl" TIMESTAMP(3) NOT NULL,
    "reemplazaAId" TEXT,

    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("idComprobante")
);

-- CreateTable
CREATE TABLE "cajas" (
    "idCaja" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTA',
    "abiertaEl" TIMESTAMP(3) NOT NULL,
    "fondoInicial" DECIMAL(11,2) NOT NULL,
    "efectivoDeclarado" DECIMAL(11,2),
    "cerradaEl" TIMESTAMP(3),
    "cerradaPorUsuarioId" TEXT,
    "cerradaPorActorTipo" "ActorTipo",
    "porAusencia" BOOLEAN NOT NULL DEFAULT false,
    "efectivoEsperado" DECIMAL(11,2),
    "diferencia" DECIMAL(11,2),
    "motivo" VARCHAR(300),
    "resumen" JSONB,

    CONSTRAINT "cajas_pkey" PRIMARY KEY ("idCaja")
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "idMovimientoCaja" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "monto" DECIMAL(11,2) NOT NULL,
    "concepto" VARCHAR(200) NOT NULL,
    "creadoPorUsuarioId" TEXT NOT NULL,
    "createdAtMovimientoCaja" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("idMovimientoCaja")
);

-- CreateTable
CREATE TABLE "anulaciones_movimiento" (
    "idAnulacionMovimiento" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "motivo" VARCHAR(300) NOT NULL,
    "actorTipo" "ActorTipo" NOT NULL DEFAULT 'USUARIO',
    "creadoPorUsuarioId" TEXT,
    "createdAtAnulacionMovimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anulaciones_movimiento_pkey" PRIMARY KEY ("idAnulacionMovimiento")
);

-- CreateTable
CREATE TABLE "ajustes_caja" (
    "idAjusteCaja" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "correccionPagoId" TEXT,
    "correccionOperacionId" TEXT,
    "anulacionPagoId" TEXT,
    "formaPagoId" TEXT NOT NULL,
    "monto" DECIMAL(11,2) NOT NULL,
    "creadoPorUsuarioId" TEXT NOT NULL,
    "createdAtAjusteCaja" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_caja_pkey" PRIMARY KEY ("idAjusteCaja")
);

-- CreateTable
CREATE TABLE "correcciones_asistencia" (
    "idCorreccionAsistencia" TEXT NOT NULL,
    "claseDictadaId" TEXT NOT NULL,
    "motivo" VARCHAR(300) NOT NULL,
    "conControlAsistencia" BOOLEAN NOT NULL DEFAULT true,
    "createdAtCorreccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorUsuarioId" TEXT,

    CONSTRAINT "correcciones_asistencia_pkey" PRIMARY KEY ("idCorreccionAsistencia")
);

-- CreateTable
CREATE TABLE "correcciones_asistencia_alumnos" (
    "correccionId" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "estadoAnterior" "EstadoAsistencia",
    "estadoNuevo" "EstadoAsistencia" NOT NULL,

    CONSTRAINT "correcciones_asistencia_alumnos_pkey" PRIMARY KEY ("correccionId","alumnoId")
);

-- CreateTable
CREATE TABLE "observaciones_clase" (
    "idObservacionClase" TEXT NOT NULL,
    "claseDictadaId" TEXT NOT NULL,
    "temasVistos" VARCHAR(1000) NOT NULL,
    "observacionesInternas" VARCHAR(1000),
    "createdAtObservacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorUsuarioId" TEXT,

    CONSTRAINT "observaciones_clase_pkey" PRIMARY KEY ("idObservacionClase")
);

-- CreateTable
CREATE TABLE "indicaciones" (
    "idIndicacion" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "materiaId" TEXT NOT NULL,
    "claseDictadaId" TEXT,
    "texto" VARCHAR(1000) NOT NULL,
    "createdAtIndicacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorUsuarioId" TEXT,

    CONSTRAINT "indicaciones_pkey" PRIMARY KEY ("idIndicacion")
);

-- CreateTable
CREATE TABLE "correcciones_resultado_examen" (
    "idCorreccionResultado" TEXT NOT NULL,
    "resultadoExamenId" TEXT NOT NULL,
    "fechaAnterior" DATE NOT NULL,
    "notaAnterior" DECIMAL(4,1) NOT NULL,
    "fechaNueva" DATE NOT NULL,
    "notaNueva" DECIMAL(4,1) NOT NULL,
    "motivo" VARCHAR(300) NOT NULL,
    "createdAtCorreccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorUsuarioId" TEXT,

    CONSTRAINT "correcciones_resultado_examen_pkey" PRIMARY KEY ("idCorreccionResultado")
);

-- CreateTable
CREATE TABLE "anulaciones_resultado_examen" (
    "idAnulacionResultado" TEXT NOT NULL,
    "resultadoExamenId" TEXT NOT NULL,
    "motivo" VARCHAR(300) NOT NULL,
    "createdAtAnulacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorUsuarioId" TEXT,

    CONSTRAINT "anulaciones_resultado_examen_pkey" PRIMARY KEY ("idAnulacionResultado")
);

-- CreateTable
CREATE TABLE "historial_parametros" (
    "idHistorialParametro" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valorAnterior" TEXT NOT NULL,
    "valorNuevo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historial_parametros_pkey" PRIMARY KEY ("idHistorialParametro")
);

-- CreateTable
CREATE TABLE "historial_estados" (
    "idHistorialEstado" TEXT NOT NULL,
    "entidad" "EntidadHistorialEstado" NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" "AccionHistorialEstado" NOT NULL,
    "motivo" VARCHAR(300),
    "actorTipo" "ActorTipo" NOT NULL,
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historial_estados_pkey" PRIMARY KEY ("idHistorialEstado")
);

-- CreateTable
CREATE TABLE "fichas_mesa_entrada" (
    "idFichaMesaEntrada" TEXT NOT NULL,
    "usuarioId" TEXT,
    "activoFichaMesaEntrada" BOOLEAN NOT NULL DEFAULT true,
    "nombreFichaMesaEntrada" TEXT NOT NULL,
    "apellidoFichaMesaEntrada" TEXT NOT NULL,
    "nombreNormalizadoFichaMesaEntrada" TEXT NOT NULL,
    "apellidoNormalizadoFichaMesaEntrada" TEXT NOT NULL,
    "dniFichaMesaEntrada" TEXT NOT NULL,
    "fechaNacimientoFichaMesaEntrada" DATE NOT NULL,
    "generoFichaMesaEntrada" "Genero",
    "telefonoFichaMesaEntrada" TEXT,
    "emailFichaMesaEntrada" TEXT NOT NULL,
    "creadoPorUsuarioId" TEXT,
    "modificadoPorUsuarioId" TEXT,
    "createdAtFichaMesaEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtFichaMesaEntrada" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fichas_mesa_entrada_pkey" PRIMARY KEY ("idFichaMesaEntrada")
);

-- CreateTable
CREATE TABLE "fichas_gerente" (
    "idFichaGerente" TEXT NOT NULL,
    "usuarioId" TEXT,
    "activoFichaGerente" BOOLEAN NOT NULL DEFAULT true,
    "nombreFichaGerente" TEXT NOT NULL,
    "apellidoFichaGerente" TEXT NOT NULL,
    "nombreNormalizadoFichaGerente" TEXT NOT NULL,
    "apellidoNormalizadoFichaGerente" TEXT NOT NULL,
    "dniFichaGerente" TEXT NOT NULL,
    "fechaNacimientoFichaGerente" DATE NOT NULL,
    "generoFichaGerente" "Genero",
    "telefonoFichaGerente" TEXT,
    "emailFichaGerente" TEXT NOT NULL,
    "creadoPorUsuarioId" TEXT,
    "modificadoPorUsuarioId" TEXT,
    "createdAtFichaGerente" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtFichaGerente" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fichas_gerente_pkey" PRIMARY KEY ("idFichaGerente")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_recuperacion_tokenHashRecuperacion_key" ON "tokens_recuperacion"("tokenHashRecuperacion");

-- CreateIndex
CREATE INDEX "tokens_recuperacion_usuarioId_consumidoEnToken_idx" ON "tokens_recuperacion"("usuarioId", "consumidoEnToken");

-- CreateIndex
CREATE INDEX "solicitudes_recuperacion_emailSolicitud_creadoEnSolicitud_idx" ON "solicitudes_recuperacion"("emailSolicitud", "creadoEnSolicitud");

-- CreateIndex
CREATE INDEX "historial_tarifas_materiaId_fecha_idx" ON "historial_tarifas"("materiaId", "fecha");

-- CreateIndex
CREATE INDEX "historial_inscripciones_inscripcionId_fecha_idx" ON "historial_inscripciones"("inscripcionId", "fecha");

-- CreateIndex
CREATE INDEX "operaciones_pago_alumnoId_fechaPago_idx" ON "operaciones_pago"("alumnoId", "fechaPago");

-- CreateIndex
CREATE INDEX "operaciones_pago_cajaId_idx" ON "operaciones_pago"("cajaId");

-- CreateIndex
CREATE INDEX "correcciones_pago_pagoId_createdAtCorreccionPago_idx" ON "correcciones_pago"("pagoId", "createdAtCorreccionPago");

-- CreateIndex
CREATE UNIQUE INDEX "anulaciones_pago_pagoId_key" ON "anulaciones_pago"("pagoId");

-- CreateIndex
CREATE INDEX "correcciones_operacion_operacionId_createdAtCorreccionOpera_idx" ON "correcciones_operacion"("operacionId", "createdAtCorreccionOperacion");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_numero_key" ON "comprobantes"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_reemplazaAId_key" ON "comprobantes"("reemplazaAId");

-- CreateIndex
CREATE INDEX "comprobantes_operacionId_idx" ON "comprobantes"("operacionId");

-- CreateIndex
CREATE INDEX "cajas_usuarioId_estado_idx" ON "cajas"("usuarioId", "estado");

-- CreateIndex
CREATE INDEX "movimientos_caja_cajaId_createdAtMovimientoCaja_idx" ON "movimientos_caja"("cajaId", "createdAtMovimientoCaja");

-- CreateIndex
CREATE UNIQUE INDEX "anulaciones_movimiento_movimientoId_key" ON "anulaciones_movimiento"("movimientoId");

-- CreateIndex
CREATE INDEX "ajustes_caja_cajaId_createdAtAjusteCaja_idx" ON "ajustes_caja"("cajaId", "createdAtAjusteCaja");

-- CreateIndex
CREATE INDEX "ajustes_caja_pagoId_idx" ON "ajustes_caja"("pagoId");

-- CreateIndex
CREATE INDEX "correcciones_asistencia_claseDictadaId_createdAtCorreccion_idx" ON "correcciones_asistencia"("claseDictadaId", "createdAtCorreccion");

-- CreateIndex
CREATE INDEX "correcciones_asistencia_alumnos_alumnoId_idx" ON "correcciones_asistencia_alumnos"("alumnoId");

-- CreateIndex
CREATE UNIQUE INDEX "observaciones_clase_claseDictadaId_key" ON "observaciones_clase"("claseDictadaId");

-- CreateIndex
CREATE INDEX "indicaciones_alumnoId_materiaId_createdAtIndicacion_idx" ON "indicaciones"("alumnoId", "materiaId", "createdAtIndicacion");

-- CreateIndex
CREATE INDEX "correcciones_resultado_examen_resultadoExamenId_createdAtCo_idx" ON "correcciones_resultado_examen"("resultadoExamenId", "createdAtCorreccion");

-- CreateIndex
CREATE UNIQUE INDEX "anulaciones_resultado_examen_resultadoExamenId_key" ON "anulaciones_resultado_examen"("resultadoExamenId");

-- CreateIndex
CREATE INDEX "historial_parametros_fecha_idx" ON "historial_parametros"("fecha");

-- CreateIndex
CREATE INDEX "historial_parametros_usuarioId_idx" ON "historial_parametros"("usuarioId");

-- CreateIndex
CREATE INDEX "historial_estados_entidad_entidadId_fecha_idx" ON "historial_estados"("entidad", "entidadId", "fecha");

-- CreateIndex
CREATE INDEX "historial_estados_usuarioId_idx" ON "historial_estados"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "fichas_mesa_entrada_usuarioId_key" ON "fichas_mesa_entrada"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "fichas_mesa_entrada_dniFichaMesaEntrada_key" ON "fichas_mesa_entrada"("dniFichaMesaEntrada");

-- CreateIndex
CREATE INDEX "fichas_mesa_entrada_orden_listado_idx" ON "fichas_mesa_entrada"("apellidoNormalizadoFichaMesaEntrada", "nombreNormalizadoFichaMesaEntrada", "dniFichaMesaEntrada");

-- CreateIndex
CREATE UNIQUE INDEX "fichas_gerente_usuarioId_key" ON "fichas_gerente"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "fichas_gerente_dniFichaGerente_key" ON "fichas_gerente"("dniFichaGerente");

-- CreateIndex
CREATE INDEX "fichas_gerente_orden_listado_idx" ON "fichas_gerente"("apellidoNormalizadoFichaGerente", "nombreNormalizadoFichaGerente", "dniFichaGerente");

-- CreateIndex
CREATE INDEX "clases_dictadas_turnoId_idx" ON "clases_dictadas"("turnoId");

-- CreateIndex
CREATE INDEX "clases_dictadas_profesorId_materiaId_idx" ON "clases_dictadas"("profesorId", "materiaId");

-- CreateIndex
CREATE INDEX "pagos_inscripcionId_idx" ON "pagos"("inscripcionId");

-- CreateIndex
CREATE INDEX "pagos_operacionId_idx" ON "pagos"("operacionId");

-- CreateIndex
CREATE INDEX "turno_alumno_turnoId_vigencia_idx" ON "turno_alumno"("turnoId", "vigencia");

-- CreateIndex
CREATE INDEX "turno_alumno_alumnoId_vigencia_idx" ON "turno_alumno"("alumnoId", "vigencia");

-- AddForeignKey
ALTER TABLE "tokens_recuperacion" ADD CONSTRAINT "tokens_recuperacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_tarifas" ADD CONSTRAINT "historial_tarifas_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "materias"("idMateria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_inscripciones" ADD CONSTRAINT "historial_inscripciones_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "turno_alumno"("idInscripcion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "operaciones_pago"("idOperacionPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_inscripcionId_fkey" FOREIGN KEY ("inscripcionId") REFERENCES "turno_alumno"("idInscripcion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_pago" ADD CONSTRAINT "operaciones_pago_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "alumnos"("idAlumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_pago" ADD CONSTRAINT "operaciones_pago_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "formas_pago"("idFormaPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_pago" ADD CONSTRAINT "operaciones_pago_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("idCaja") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_pago" ADD CONSTRAINT "correcciones_pago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("idPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anulaciones_pago" ADD CONSTRAINT "anulaciones_pago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("idPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_operacion" ADD CONSTRAINT "correcciones_operacion_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "operaciones_pago"("idOperacionPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_operacion" ADD CONSTRAINT "correcciones_operacion_formaPagoAnteriorId_fkey" FOREIGN KEY ("formaPagoAnteriorId") REFERENCES "formas_pago"("idFormaPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_operacion" ADD CONSTRAINT "correcciones_operacion_formaPagoNuevaId_fkey" FOREIGN KEY ("formaPagoNuevaId") REFERENCES "formas_pago"("idFormaPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "operaciones_pago"("idOperacionPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_reemplazaAId_fkey" FOREIGN KEY ("reemplazaAId") REFERENCES "comprobantes"("idComprobante") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("idCaja") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anulaciones_movimiento" ADD CONSTRAINT "anulaciones_movimiento_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "movimientos_caja"("idMovimientoCaja") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_caja" ADD CONSTRAINT "ajustes_caja_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("idCaja") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_caja" ADD CONSTRAINT "ajustes_caja_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("idPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_caja" ADD CONSTRAINT "ajustes_caja_correccionPagoId_fkey" FOREIGN KEY ("correccionPagoId") REFERENCES "correcciones_pago"("idCorreccionPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_caja" ADD CONSTRAINT "ajustes_caja_correccionOperacionId_fkey" FOREIGN KEY ("correccionOperacionId") REFERENCES "correcciones_operacion"("idCorreccionOperacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_caja" ADD CONSTRAINT "ajustes_caja_anulacionPagoId_fkey" FOREIGN KEY ("anulacionPagoId") REFERENCES "anulaciones_pago"("idAnulacionPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_caja" ADD CONSTRAINT "ajustes_caja_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "formas_pago"("idFormaPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_asistencia" ADD CONSTRAINT "correcciones_asistencia_claseDictadaId_fkey" FOREIGN KEY ("claseDictadaId") REFERENCES "clases_dictadas"("idClaseDictada") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_asistencia_alumnos" ADD CONSTRAINT "correcciones_asistencia_alumnos_correccionId_fkey" FOREIGN KEY ("correccionId") REFERENCES "correcciones_asistencia"("idCorreccionAsistencia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_asistencia_alumnos" ADD CONSTRAINT "correcciones_asistencia_alumnos_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "alumnos"("idAlumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones_clase" ADD CONSTRAINT "observaciones_clase_claseDictadaId_fkey" FOREIGN KEY ("claseDictadaId") REFERENCES "clases_dictadas"("idClaseDictada") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicaciones" ADD CONSTRAINT "indicaciones_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "alumnos"("idAlumno") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicaciones" ADD CONSTRAINT "indicaciones_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "materias"("idMateria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicaciones" ADD CONSTRAINT "indicaciones_claseDictadaId_fkey" FOREIGN KEY ("claseDictadaId") REFERENCES "clases_dictadas"("idClaseDictada") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_resultado_examen" ADD CONSTRAINT "correcciones_resultado_examen_resultadoExamenId_fkey" FOREIGN KEY ("resultadoExamenId") REFERENCES "resultados_examen"("idResultadoExamen") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anulaciones_resultado_examen" ADD CONSTRAINT "anulaciones_resultado_examen_resultadoExamenId_fkey" FOREIGN KEY ("resultadoExamenId") REFERENCES "resultados_examen"("idResultadoExamen") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_mesa_entrada" ADD CONSTRAINT "fichas_mesa_entrada_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("idUsuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_gerente" ADD CONSTRAINT "fichas_gerente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("idUsuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Objetos manuales
-- ============================================================

-- ---------- Inscripción (turno_alumno, PR-0.md §2.1) ----------
-- Una sola inscripción VIGENTE por (alumno, turno); las finalizadas se conservan.
CREATE UNIQUE INDEX "turno_alumno_vigente_key" ON "turno_alumno" ("alumnoId", "turnoId")
  WHERE "vigencia" = 'VIGENTE';

ALTER TABLE "turno_alumno"
  ADD CONSTRAINT "turno_alumno_precio_check" CHECK ("precio" > 0),
  -- VIGENTE ⇔ sin finalizar; toda finalización guarda fecha y actor.
  ADD CONSTRAINT "turno_alumno_finalizada_check" CHECK (
    ("vigencia" = 'VIGENTE' AND "finalizadaEl" IS NULL
      AND "finalizadaPorActorTipo" IS NULL AND "finalizadaPorUsuarioId" IS NULL)
    OR ("vigencia" <> 'VIGENTE' AND "finalizadaEl" IS NOT NULL AND "finalizadaPorActorTipo" IS NOT NULL)
  ),
  ADD CONSTRAINT "turno_alumno_actor_check" CHECK (
    "finalizadaPorActorTipo" IS NULL
    OR ("finalizadaPorActorTipo" = 'USUARIO' AND "finalizadaPorUsuarioId" IS NOT NULL)
    OR ("finalizadaPorActorTipo" = 'PROCESO_AUTOMATICO' AND "finalizadaPorUsuarioId" IS NULL)
  ),
  -- RESERVADA ⇔ tiene vencimiento (venceBaseEl y venceEl juntos, venceEl ≤ venceBaseEl).
  -- Al finalizar la inscripción los valores quedan congelados, así que la
  -- regla vale también para las no vigentes.
  ADD CONSTRAINT "turno_alumno_vencimiento_check" CHECK (
    ("venceEl" IS NULL) = ("venceBaseEl" IS NULL)
    AND (("estadoPago" = 'RESERVADA') = ("venceEl" IS NOT NULL))
    AND ("venceEl" IS NULL OR ("inicioPlazo" IS NOT NULL AND "venceEl" <= "venceBaseEl"))
  );

ALTER TABLE "historial_inscripciones"
  ADD CONSTRAINT "historial_inscripciones_actor_check" CHECK (
    ("actorTipo" = 'USUARIO' AND "usuarioId" IS NOT NULL)
    OR ("actorTipo" = 'PROCESO_AUTOMATICO' AND "usuarioId" IS NULL)
  );

-- ---------- Reservas de recursos (PR-0.md §2.0) ----------
-- Reemplaza las funciones de 20260924150000_turnos_reservas_recursos_v2: la
-- proyección de alumnos considera solo inscripciones VIGENTE. Así una
-- inscripción histórica y otra vigente del mismo alumno en la misma clase no
-- chocan en la PK de reservas_turno, y finalizar una inscripción libera al
-- alumno (EXCLUDE). El trigger de turnos sigue escuchando "profesorId"
-- (confirmado contra la migración original: no cambia su lista de columnas).
CREATE OR REPLACE FUNCTION sincronizar_reservas_turno() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  inicio timestamp;
  fin timestamp;
BEGIN
  DELETE FROM "reservas_turno" WHERE "turnoId" = NEW."idTurno";
  IF NEW."estadoTurno" IN ('DISPONIBLE', 'COMPLETO') THEN
    inicio := NEW."fechaTurno" + NEW."horaInicioTurno";
    fin := inicio + NEW."duracionMinutosTurno" * interval '1 minute';
    IF NEW."profesorId" IS NOT NULL THEN
      INSERT INTO "reservas_turno" VALUES (NEW."idTurno", 'PROFESOR', NEW."profesorId", inicio, fin);
    END IF;
    IF NEW."aulaId" IS NOT NULL THEN
      INSERT INTO "reservas_turno" VALUES (NEW."idTurno", 'AULA', NEW."aulaId", inicio, fin);
    END IF;
    INSERT INTO "reservas_turno" ("turnoId", "tipoRecurso", "recursoId", "inicioReserva", "finReserva")
    SELECT NEW."idTurno", 'ALUMNO', ta."alumnoId", inicio, fin
    FROM "turno_alumno" ta
    WHERE ta."turnoId" = NEW."idTurno" AND ta."vigencia" = 'VIGENTE'
    ORDER BY ta."alumnoId";
  END IF;
  RETURN NEW;
END $$;

-- Baja lógica: la reserva del alumno se borra cuando la inscripción deja de
-- ser VIGENTE y se crea cuando nace (o vuelve a ser) VIGENTE. El lock del
-- turno coordina con la confirmación de la clase, como antes.
CREATE OR REPLACE FUNCTION sincronizar_reserva_alumno() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  turno "turnos"%ROWTYPE;
  inicio timestamp;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD."vigencia" = 'VIGENTE' THEN
    SELECT * INTO turno FROM "turnos" WHERE "idTurno" = OLD."turnoId" FOR UPDATE;
    DELETE FROM "reservas_turno" WHERE "turnoId" = OLD."turnoId"
      AND "tipoRecurso" = 'ALUMNO' AND "recursoId" = OLD."alumnoId";
  END IF;
  IF TG_OP <> 'DELETE' AND NEW."vigencia" = 'VIGENTE' THEN
    SELECT * INTO turno FROM "turnos" WHERE "idTurno" = NEW."turnoId" FOR UPDATE;
    IF turno."estadoTurno" IN ('DISPONIBLE', 'COMPLETO') THEN
      inicio := turno."fechaTurno" + turno."horaInicioTurno";
      INSERT INTO "reservas_turno" VALUES (
        NEW."turnoId", 'ALUMNO', NEW."alumnoId", inicio,
        inicio + turno."duracionMinutosTurno" * interval '1 minute'
      );
    END IF;
  END IF;
  RETURN NULL;
END $$;

-- Solo las columnas que mueven la reserva: cambiar estadoPago, vencimientos o
-- precio no la toca.
DROP TRIGGER "turno_alumno_sincronizar_reserva" ON "turno_alumno";
CREATE TRIGGER "turno_alumno_sincronizar_reserva"
AFTER INSERT OR UPDATE OF "vigencia", "turnoId", "alumnoId" OR DELETE ON "turno_alumno"
FOR EACH ROW EXECUTE FUNCTION sincronizar_reserva_alumno();

-- ---------- Pagos, operaciones y comprobantes (PR-0.md §2.3) ----------
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_precio_check" CHECK ("precio" > 0);
ALTER TABLE "correcciones_pago" ADD CONSTRAINT "correcciones_pago_montos_check"
  CHECK ("montoAnterior" > 0 AND "montoNuevo" > 0);
ALTER TABLE "anulaciones_pago" ADD CONSTRAINT "anulaciones_pago_actor_check" CHECK (
  ("actorTipo" = 'USUARIO' AND "creadoPorUsuarioId" IS NOT NULL)
  OR ("actorTipo" = 'PROCESO_AUTOMATICO' AND "creadoPorUsuarioId" IS NULL)
);
-- Una fila por campo que cambia: forma de pago o fecha de pago, nunca ambos.
ALTER TABLE "correcciones_operacion" ADD CONSTRAINT "correcciones_operacion_campo_check" CHECK (
  ("formaPagoAnteriorId" IS NOT NULL AND "formaPagoNuevaId" IS NOT NULL
    AND "fechaPagoAnterior" IS NULL AND "fechaPagoNueva" IS NULL)
  OR ("formaPagoAnteriorId" IS NULL AND "formaPagoNuevaId" IS NULL
    AND "fechaPagoAnterior" IS NOT NULL AND "fechaPagoNueva" IS NOT NULL)
);

-- Número de comprobante: se toma con nextval dentro de la transacción del
-- pago (nextval devuelve bigint: el servicio lo convierte a número). Puede
-- haber saltos, nunca repeticiones dentro de la misma base.
CREATE SEQUENCE "comprobante_numero_seq" AS integer START WITH 1 INCREMENT BY 1 NO CYCLE;

-- ---------- Caja (PR-0.md §2.5) ----------
-- Como máximo una caja ABIERTA por integrante.
CREATE UNIQUE INDEX "cajas_abierta_por_integrante_key" ON "cajas" ("usuarioId")
  WHERE "estado" = 'ABIERTA';

ALTER TABLE "cajas"
  ADD CONSTRAINT "cajas_montos_check" CHECK (
    "fondoInicial" >= 0 AND ("efectivoDeclarado" IS NULL OR "efectivoDeclarado" >= 0)
  ),
  -- Abierta: sin datos de cierre. Cerrada: fecha, actor y arqueo completos.
  ADD CONSTRAINT "cajas_cierre_check" CHECK (
    ("estado" = 'ABIERTA' AND "cerradaEl" IS NULL AND "cerradaPorActorTipo" IS NULL
      AND "cerradaPorUsuarioId" IS NULL AND "porAusencia" = false
      AND "efectivoEsperado" IS NULL AND "diferencia" IS NULL AND "resumen" IS NULL)
    OR ("estado" = 'CERRADA' AND "cerradaEl" IS NOT NULL AND "cerradaPorActorTipo" IS NOT NULL
      AND "efectivoDeclarado" IS NOT NULL AND "efectivoEsperado" IS NOT NULL
      AND "diferencia" IS NOT NULL AND "resumen" IS NOT NULL)
  ),
  ADD CONSTRAINT "cajas_actor_check" CHECK (
    "cerradaPorActorTipo" IS NULL
    OR ("cerradaPorActorTipo" = 'USUARIO' AND "cerradaPorUsuarioId" IS NOT NULL)
    OR ("cerradaPorActorTipo" = 'PROCESO_AUTOMATICO' AND "cerradaPorUsuarioId" IS NULL)
  );

ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_monto_check" CHECK ("monto" > 0);
ALTER TABLE "anulaciones_movimiento" ADD CONSTRAINT "anulaciones_movimiento_actor_check" CHECK (
  ("actorTipo" = 'USUARIO' AND "creadoPorUsuarioId" IS NOT NULL)
  OR ("actorTipo" = 'PROCESO_AUTOMATICO' AND "creadoPorUsuarioId" IS NULL)
);
-- Monto con signo, nunca 0; exactamente un origen (corrección de monto,
-- corrección de operación o anulación).
ALTER TABLE "ajustes_caja"
  ADD CONSTRAINT "ajustes_caja_monto_check" CHECK ("monto" <> 0),
  ADD CONSTRAINT "ajustes_caja_origen_check" CHECK (
    num_nonnulls("correccionPagoId", "correccionOperacionId", "anulacionPagoId") = 1
  );

-- Forma de pago de efectivo (PR-0.md §2.5): por id fijo del catálogo de
-- 20260921210000, nunca por nombre.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "formas_pago" WHERE "idFormaPago" = 'formapago-efectivo') THEN
    RAISE EXCEPTION 'No existe la forma de pago formapago-efectivo: resolvé a mano qué forma es el efectivo antes de migrar (no se elige por nombre)';
  END IF;
END $$;
UPDATE "formas_pago" SET "esEfectivo" = true WHERE "idFormaPago" = 'formapago-efectivo';

-- ---------- Tarifas (PR-0.md §2.4) ----------
ALTER TABLE "materias" ADD CONSTRAINT "materias_tarifa_hora_check"
  CHECK ("tarifaHoraMateria" IS NULL OR "tarifaHoraMateria" > 0);
ALTER TABLE "historial_tarifas" ADD CONSTRAINT "historial_tarifas_montos_check"
  CHECK ("tarifaNueva" > 0 AND ("tarifaAnterior" IS NULL OR "tarifaAnterior" > 0));

-- ---------- Clase dictada (PR-0.md §2.8) ----------
-- Una sola clase dictada no anulada por turno (reemplaza clases_dictadas_turnoId_key).
CREATE UNIQUE INDEX "clases_dictadas_turno_no_anulada_key" ON "clases_dictadas" ("turnoId")
  WHERE "anuladaEl" IS NULL;
ALTER TABLE "clases_dictadas" ADD CONSTRAINT "clases_dictadas_anulacion_check" CHECK (
  ("anuladaEl" IS NULL AND "anuladaPorUsuarioId" IS NULL AND "motivoAnulacion" IS NULL)
  OR ("anuladaEl" IS NOT NULL AND "motivoAnulacion" IS NOT NULL)
);

-- ---------- Historial de bajas y reactivaciones (PR-0.md §2.13) ----------
ALTER TABLE "historial_estados" ADD CONSTRAINT "historial_estados_actor_check" CHECK (
  ("actorTipo" = 'USUARIO' AND "usuarioId" IS NOT NULL)
  OR ("actorTipo" = 'PROCESO_AUTOMATICO' AND "usuarioId" IS NULL)
);

-- ---------- Parámetros y datos del centro (PR-0.md §2.6) ----------
-- Valores por defecto para una base sin seed. Los cambia HU-N-01; el seed no
-- los pisa.
INSERT INTO "parametros_sistema" ("clave", "valor") VALUES
  ('plazo_pago_horas', '24'),
  ('cancelacion_anticipacion_horas', '24'),
  ('umbral_presentismo', '75'),
  ('centro_nombre', 'Instituto Noctium'),
  ('centro_domicilio', 'Av. Siempreviva 742'),
  ('centro_telefono', '351-4000000')
ON CONFLICT ("clave") DO NOTHING;

COMMIT;
