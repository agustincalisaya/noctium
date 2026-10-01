import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hoyEnZonaCentro } from "@/lib/calendario-semana";
import { bloquearTurnoParaOperacion, obtenerAlumnosInscriptosDeTurno } from "@/server/turnos/turno.publico";
import { obtenerAlumnosBasicos } from "@/server/alumnos/alumno.publico";
import { existeFormaPago, listarFormasPagoActivas, verificarFormaPagoActiva } from "@/server/pagos/forma-pago.publico";
import { ServiceError } from "@/server/shared/service-error";
import type { RegistrarPagoInput } from "@/server/pagos/pago.schema";
import type { OpcionesPago, PagoRegistrado } from "@/types/pago.types";

/** Fecha civil del centro, independiente de la zona del proceso o del navegador. */
export const fechaHoyArgentina = hoyEnZonaCentro;

export async function registrarPago(input: RegistrarPagoInput, usuarioId: string): Promise<PagoRegistrado> {
  return prisma.$transaction(async (tx) => {
    const turno = await bloquearTurnoParaOperacion(input.turno_id, tx);
    if (!turno) throw new ServiceError("TURNO_NO_ENCONTRADO");
    if (turno.estado !== "DISPONIBLE" && turno.estado !== "COMPLETO") throw new ServiceError("TURNO_NO_ADMITE_PAGO");
    if (!turno.alumno_ids.includes(input.alumno_id)) throw new ServiceError("ALUMNO_NO_INSCRIPTO");

    const forma = await verificarFormaPagoActiva(input.forma_pago_id, tx);
    if (!forma) {
      throw new ServiceError(await existeFormaPago(input.forma_pago_id, tx)
        ? "FORMA_PAGO_NO_DISPONIBLE" : "FORMA_PAGO_NO_ENCONTRADA");
    }
    const hoy = fechaHoyArgentina();
    const fechaPago = input.fecha_pago ?? new Date(`${hoy}T00:00:00.000Z`);
    if (fechaPago.toISOString().slice(0, 10) > hoy) throw new ServiceError("FECHA_PAGO_FUTURA");

    const [alumno] = await obtenerAlumnosBasicos([input.alumno_id], tx);
    if (!alumno) throw new ServiceError("ALUMNO_NO_INSCRIPTO");
    const pago = await tx.pago.create({
      data: {
        turnoId: input.turno_id, alumnoId: input.alumno_id,
        montoPago: new Prisma.Decimal(input.monto), formaPagoId: input.forma_pago_id,
        fechaPago, creadoPorUsuarioId: usuarioId,
      },
    });
    return {
      id: pago.idPago, turno_id: pago.turnoId,
      alumno: { id: alumno.id, nombre_completo: `${alumno.apellido}, ${alumno.nombre}` },
      monto: pago.montoPago.toFixed(2), forma_pago: forma,
      fecha_pago: pago.fechaPago.toISOString().slice(0, 10),
    };
  });
}

export async function obtenerOpcionesPago(turnoId: string): Promise<OpcionesPago> {
  const ids = await obtenerAlumnosInscriptosDeTurno(turnoId);
  if (ids === null) throw new ServiceError("TURNO_NO_ENCONTRADO");
  const [alumnos, formas] = await Promise.all([obtenerAlumnosBasicos(ids), listarFormasPagoActivas()]);
  const activas = new Set(formas.map(({ id }) => id));
  return {
    alumnos: alumnos.map((alumno) => ({
      id: alumno.id, nombre_completo: `${alumno.apellido}, ${alumno.nombre}`, dni: alumno.dni,
      forma_pago_preferida_id: alumno.forma_pago_preferida_id && activas.has(alumno.forma_pago_preferida_id)
        ? alumno.forma_pago_preferida_id : null,
    })),
    formas_pago: formas,
    ...(alumnos.length === 1 ? { preseleccionar_alumno_id: alumnos[0].id } : {}),
  };
}
