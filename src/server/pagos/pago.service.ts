import { hoyEnZonaCentro } from "@/lib/calendario-semana";
import { obtenerAlumnosInscriptosDeTurno } from "@/server/turnos/turno.publico";
import { inscripcionVigenteDelPar, obtenerClasesBasicas } from "@/server/turnos/inscripcion.publico";
import { obtenerAlumnosBasicos } from "@/server/alumnos/alumno.publico";
import { listarFormasPagoActivas, verificarFormaPagoActiva } from "@/server/pagos/forma-pago.publico";
import { registrarOperacion } from "@/server/pagos/operacion.service";
import { ServiceError } from "@/server/shared/service-error";
import { transaccion } from "@/server/shared/transaccion";
import type { RegistrarPagoInput } from "@/server/pagos/pago.schema";
import type { OpcionesPago, PagoRegistrado } from "@/types/pago.types";

/** Fecha civil del centro, independiente de la zona del proceso o del navegador. */
export const fechaHoyArgentina = hoyEnZonaCentro;

/**
 * `POST /api/pagos` (HU-I-01): conserva el contrato de Sprint 2 (PR-0.md
 * §2.15). Por dentro busca la inscripción vigente del par (clase, alumno) y
 * llama a `registrarOperacion` con una clase y el modo de compatibilidad
 * (2.13): exige además una caja abierta del usuario (`CAJA_NO_ABIERTA`) y
 * emite el comprobante, que la respuesta suma como campo extra.
 */
export async function registrarPago(input: RegistrarPagoInput, usuarioId: string): Promise<PagoRegistrado & { comprobante: { id: string; numero: string } }> {
  return transaccion(async (tx) => {
    // Mismos códigos y orden que en Sprint 2: turno, estado e inscripción;
    // registrarOperacion los revalida con todo bloqueado y sigue con forma y fecha.
    const [clase] = await obtenerClasesBasicas([input.turno_id], tx);
    if (!clase) throw new ServiceError("TURNO_NO_ENCONTRADO");
    if (clase.estado !== "DISPONIBLE" && clase.estado !== "COMPLETO") throw new ServiceError("TURNO_NO_ADMITE_PAGO");
    const inscripcion = await inscripcionVigenteDelPar(input.alumno_id, input.turno_id, tx);
    if (!inscripcion) throw new ServiceError("ALUMNO_NO_INSCRIPTO");

    const { operacion, pagos: [pago], comprobante } = await registrarOperacion(tx, {
      alumnoId: input.alumno_id,
      items: [{ inscripcionId: inscripcion.id, monto: input.monto }],
      formaPagoId: input.forma_pago_id,
      fechaPago: input.fecha_pago,
      usuarioId,
      modo: "compatSprint2",
    });
    const [[alumno], forma] = await Promise.all([
      obtenerAlumnosBasicos([input.alumno_id], tx),
      verificarFormaPagoActiva(input.forma_pago_id, tx),
    ]);
    if (!alumno || !pago || !forma) throw new ServiceError("ALUMNO_NO_INSCRIPTO");
    return {
      id: pago.id, turno_id: pago.turnoId,
      alumno: { id: alumno.id, nombre_completo: `${alumno.apellido}, ${alumno.nombre}` },
      monto: pago.monto, forma_pago: forma,
      fecha_pago: operacion.fechaPago.toISOString().slice(0, 10),
      comprobante: { id: comprobante.id, numero: comprobante.numeroVisible },
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
