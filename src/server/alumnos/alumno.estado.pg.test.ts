import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient, RolUsuario } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import {
  abrirCajaDePrueba, crearAlumnoDePrueba, crearAulaDePrueba, crearClaseDictadaDePrueba, crearFichaMesaEntradaDePrueba,
  crearInscripcionDePrueba, crearMateriaDePrueba, crearOperacionDePrueba, crearProfesorDePrueba, crearTurnoDePrueba,
  crearUsuarioDePrueba, unico,
} from "@/server/testing/fabricas";
import { prisma } from "@/lib/prisma";
import * as bloqueos from "@/server/shared/bloquear";
import * as cuentas from "@/server/usuarios/cuenta.service";
import * as usuarios from "@/server/usuarios/usuario.service";
import { actorUsuario, REINTENTOS_HISTORIAL } from "@/server/shared/historial";
import * as historialEstados from "@/server/shared/historial-estados";
import { listarHistorialEstados } from "@/server/shared/historial-estados";
import { conReloj } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";
import {
  desactivarAlumno, obtenerHistorialEstadosAlumno, obtenerImpactoBajaAlumno, reactivarAlumno,
} from "@/server/alumnos/alumno.estado.service";
import { confirmarCodigoAutorregistro, iniciarAutorregistro } from "@/server/alumnos/autorregistro.service";
import { verificarPermiso } from "@/server/shared/with-permission";
import { agregarAlumnoTurno, asignarParticipantesTurno, solicitarTurnoPropio } from "@/server/turnos/turno.service";
import { registrarOperacion, type DatosOperacion } from "@/server/pagos/operacion.service";

// Sesión simulada para verificarPermiso: la cuenta y el RBAC se leen de la base real.
const sesion = vi.hoisted(() => ({ actual: null as null | { id: string; rol: string; iat: number } }));
vi.mock("@/auth", () => ({
  auth: async () => (sesion.actual ? { user: { id: sesion.actual.id, rol: sesion.actual.rol } } : null),
  decodificarToken: async () => (sesion.actual ? { iat_sesion: sesion.actual.iat } : null),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token-de-prueba" }) }) }));

process.env.CODIGO_OTP_SECRET ??= "secreto-de-prueba-hu-b-07";

// Mediodía en la zona del centro (15:00 UTC).
const MOMENTO = new Date("2026-10-05T15:00:00.000Z");
const HORA = 3_600_000;

describe.skipIf(!basePgHabilitada)("HU-B-07: baja y reactivación del alumno en PostgreSQL real", () => {
  let db: PrismaClient;
  let mesa: string;
  let cajaId: string;
  const alumnosCreados: string[] = [];

  const nuevoAlumno = async (conCuenta = false) => {
    const usuario = conCuenta ? await crearUsuarioDePrueba(db, { rol: "ALUMNO" }) : null;
    const alumno = await crearAlumnoDePrueba(db, { usuarioId: usuario?.idUsuario ?? null });
    alumnosCreados.push(alumno.idAlumno);
    return { alumnoId: alumno.idAlumno, usuarioId: usuario?.idUsuario ?? null };
  };
  const actor = () => actorUsuario(mesa);
  const darBaja = (id: string, version = 0, motivo?: string) => desactivarAlumno(id, { version, motivo }, actor());
  const inscripcion = (id: string) => db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: id } });
  const permisoConSesion = async (usuario: { id: string; rol: RolUsuario }, iat: number, accion: string) => {
    sesion.actual = { ...usuario, iat };
    try { return await verificarPermiso(accion); } finally { sesion.actual = null; }
  };

  /** Integrante de mesa de entrada con caja abierta y una forma de pago en efectivo propia de la prueba. */
  const cobradorConCaja = async () => {
    const usuarioId = (await crearUsuarioDePrueba(db, { rol: "MESA_ENTRADA" })).idUsuario;
    await abrirCajaDePrueba(db, { usuarioId });
    const nombre = unico("Efectivo B07 ");
    const forma = await db.formaPago.create({ data: { nombreFormaPago: nombre, nombreNormalizadaFormaPago: nombre.toLowerCase(), esEfectivo: true } });
    return { usuarioId, formaPagoId: forma.idFormaPago };
  };
  const cobrar = (cobrador: { usuarioId: string; formaPagoId: string }, alumnoId: string, item: DatosOperacion["items"][number]) =>
    transaccion((tx) => registrarOperacion(tx, { alumnoId, usuarioId: cobrador.usuarioId, modo: "completo", formaPagoId: cobrador.formaPagoId, items: [item] }));

  /** Sondea `pg_stat_activity` hasta que `n` sesiones esperan un bloqueo de fila: la otra operación ya está esperando en la base. */
  const esperarBloqueados = async (n = 1) => {
    for (let intento = 0; intento < 400; intento++) {
      const [{ c }] = await db.$queryRaw<{ c: bigint }[]>`
        SELECT count(*) AS c FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (Number(c) >= n) return;
      await new Promise((resolver) => setTimeout(resolver, 25));
    }
    throw new Error(`Ninguna de las ${n} sesiones llegó a esperar un bloqueo`);
  };

  /** Pausa la primera llamada a `bloquear` (la de la operación que va primero) después de tomar el bloqueo. */
  function pausarPrimerBloqueo() {
    let soltar!: () => void;
    let tomado!: () => void;
    const listo = new Promise<void>((r) => { tomado = r; });
    const espera = new Promise<void>((r) => { soltar = r; });
    const original = bloqueos.bloquear;
    let primera = true;
    const espia = vi.spyOn(bloqueos, "bloquear").mockImplementation(async (tx, input) => {
      const resultado = await original(tx, input);
      if (primera) { primera = false; tomado(); await espera; }
      return resultado;
    });
    return { listo, soltar: () => soltar(), restaurar: () => espia.mockRestore() };
  }

  /**
   * Intercalado forzado en dos conexiones: `primera` toma sus bloqueos y deja la transacción abierta;
   * las `siguientes` se lanzan entonces y esperan en la base (se comprueba en `pg_stat_activity`);
   * recién después se suelta a `primera`. Devuelve los resultados en el orden `[primera, ...siguientes]`.
   */
  async function intercalar(primera: () => Promise<unknown>, ...siguientes: (() => Promise<unknown>)[]) {
    const pausa = pausarPrimerBloqueo();
    try {
      const gana = primera();
      await Promise.race([pausa.listo, gana.then(() => { throw new Error("la primera operación terminó sin tomar un bloqueo"); })]);
      const esperan = siguientes.map((siguiente) => siguiente());
      try { await esperarBloqueados(siguientes.length); } finally { pausa.soltar(); }
      return await Promise.allSettled([gana, ...esperan]);
    } finally {
      pausa.restaurar();
    }
  }

  beforeAll(async () => {
    db = clientePg();
    mesa = (await crearUsuarioDePrueba(db, { rol: "MESA_ENTRADA" })).idUsuario;
    cajaId = (await abrirCajaDePrueba(db, { usuarioId: mesa })).idCaja;
  });
  afterAll(async () => {
    // Otras suites eligen «el primer alumno activo»: estas fichas pertenecen a esta suite.
    await db?.alumno.updateMany({ where: { idAlumno: { in: alumnosCreados } }, data: { activoAlumno: false } });
    await db?.$disconnect();
  });

  it("quita solo las futuras Disponibles o Completas, marca la reserva vencida y deja intactos pagos, dictadas, cuenta e historial coherentes", async () => {
    await conReloj(MOMENTO, async () => {
      const { alumnoId, usuarioId } = await nuevoAlumno(true);
      const futura = await crearTurnoDePrueba(db, { enDias: 2 });
      const completa = await crearTurnoDePrueba(db, { enDias: 3, cupo: 1 });
      const enCurso = await crearTurnoDePrueba(db, { enDias: 0, hora: "11:30" });
      const pasada = await crearTurnoDePrueba(db, { enDias: -3 });
      const pendiente = await crearTurnoDePrueba(db, { enDias: 5, estado: "PENDIENTE" });
      const cancelada = await crearTurnoDePrueba(db, { enDias: 6, estado: "CANCELADO" });
      const conReservaVencida = await crearTurnoDePrueba(db, { enDias: 7 });

      const iFutura = await crearInscripcionDePrueba(db, { turnoId: futura.idTurno, alumnoId });
      const iCompleta = await crearInscripcionDePrueba(db, { turnoId: completa.idTurno, alumnoId });
      await db.turno.update({ where: { idTurno: completa.idTurno }, data: { estadoTurno: "COMPLETO" } });
      const iEnCurso = await crearInscripcionDePrueba(db, { turnoId: enCurso.idTurno, alumnoId });
      const iPasada = await crearInscripcionDePrueba(db, { turnoId: pasada.idTurno, alumnoId });
      const iPendiente = await crearInscripcionDePrueba(db, { turnoId: pendiente.idTurno, alumnoId });
      const iCancelada = await crearInscripcionDePrueba(db, { turnoId: cancelada.idTurno, alumnoId });
      // Borde: vence exactamente ahora (reserva de hace 24 h con plazo de 24 h).
      const iVencida = await crearInscripcionDePrueba(db, {
        turnoId: conReservaVencida.idTurno, alumnoId, estadoPago: "RESERVADA", reservadaEl: new Date(MOMENTO.getTime() - 24 * HORA),
      });
      expect((await inscripcion(iVencida.idInscripcion)).venceEl).toEqual(MOMENTO);

      const { pagos } = await crearOperacionDePrueba(db, { cajaId, inscripcionIds: [iCompleta.idInscripcion] });
      await crearClaseDictadaDePrueba(db, { turnoId: pasada.idTurno, alumnos: [{ alumnoId, estado: "PRESENTE" }] });
      const dictadasAntes = await db.claseDictadaAlumno.count({ where: { alumnoId } });
      const intactasAntes = await db.turnoAlumno.findMany({
        where: { idInscripcion: { in: [iEnCurso, iPasada, iPendiente, iCancelada].map((i) => i.idInscripcion) } }, orderBy: { idInscripcion: "asc" },
      });

      const impacto = await obtenerImpactoBajaAlumno(alumnoId);
      expect(impacto.motivo_obligatorio).toBe(true);
      await expect(darBaja(alumnoId)).rejects.toMatchObject({ code: "MOTIVO_REQUERIDO" });
      await expect(darBaja(alumnoId, 7, "Se mudó")).rejects.toMatchObject({ code: "CONFLICTO_EDICION_CONCURRENTE" });

      const resultado = await darBaja(alumnoId, 0, "Se mudó");
      expect(resultado).toMatchObject({ activo: false, version: 1, inscripciones_quitadas: 2 });

      const bajas = await db.turnoAlumno.findMany({ where: { alumnoId, vigencia: "BAJA_ALUMNO" }, orderBy: { idInscripcion: "asc" } });
      expect(bajas.map((b) => b.idInscripcion)).toEqual([iFutura.idInscripcion, iCompleta.idInscripcion].sort());
      expect(impacto.inscripciones_futuras.map((i) => i.inscripcion_id).sort()).toEqual(bajas.map((b) => b.idInscripcion));
      for (const baja of bajas) {
        expect(baja).toMatchObject({ finalizadaEl: MOMENTO, finalizadaPorActorTipo: "USUARIO", finalizadaPorUsuarioId: mesa });
      }
      expect((await db.turno.findUniqueOrThrow({ where: { idTurno: completa.idTurno } })).estadoTurno).toBe("DISPONIBLE");
      expect((await inscripcion(iVencida.idInscripcion)).vigencia).toBe("RESERVA_VENCIDA");
      expect(await db.turnoAlumno.findMany({
        where: { idInscripcion: { in: intactasAntes.map((i) => i.idInscripcion) } }, orderBy: { idInscripcion: "asc" },
      })).toEqual(intactasAntes);
      expect(await db.turnoAlumno.count({ where: { alumnoId } })).toBe(7);
      expect(await db.pago.findUniqueOrThrow({ where: { idPago: pagos[0].idPago } })).toEqual(pagos[0]);
      expect((await inscripcion(iCompleta.idInscripcion)).estadoPago).toBe("PAGADA");
      expect(await db.claseDictadaAlumno.count({ where: { alumnoId } })).toBe(dictadasAntes);

      const cuenta = await db.usuario.findUniqueOrThrow({ where: { idUsuario: usuarioId! } });
      expect(cuenta.activoUsuario).toBe(false);
      expect(cuenta.sesionesValidasDesdeUsuario).not.toBeNull();
      expect(await listarHistorialEstados("ALUMNO", alumnoId)).toEqual([
        expect.objectContaining({ accion: "DESACTIVAR", motivo: "Se mudó", usuario_id: mesa }),
      ]);
      await expect(darBaja(alumnoId, 1, "Otra vez")).rejects.toMatchObject({ code: "ALUMNO_YA_INACTIVO" });
    });
  });

  it("la sesión abierta del alumno responde 401 en la próxima solicitud", async () => {
    const { alumnoId, usuarioId } = await nuevoAlumno(true);
    const usuario = { id: usuarioId!, rol: "ALUMNO" as const };
    const iat = Math.floor(Date.now() / 1000) - 60;
    // Antes de la baja la sesión pasa la verificación de cuenta y llega al RBAC.
    await expect(permisoConSesion(usuario, iat, "prueba:hu_b_07")).rejects.toMatchObject({ status: 403, code: "SIN_PERMISO" });
    await darBaja(alumnoId);
    await expect(permisoConSesion(usuario, iat, "prueba:hu_b_07")).rejects.toMatchObject({ status: 401, code: "SESION_INVALIDA" });
  });

  it("alumnos:cambiar_estado: solo Mesa de Entrada; Gerente, Profesor y Alumno reciben 403", async () => {
    const iat = Math.floor(Date.now() / 1000);
    await expect(permisoConSesion({ id: mesa, rol: "MESA_ENTRADA" }, iat, "alumnos:cambiar_estado")).resolves.toMatchObject({ id: mesa });
    for (const rol of ["GERENTE", "PROFESOR", "ALUMNO"] as const) {
      const usuario = await crearUsuarioDePrueba(db, { rol });
      await expect(permisoConSesion({ id: usuario.idUsuario, rol }, iat, "alumnos:cambiar_estado")).rejects.toMatchObject({ status: 403, code: "SIN_PERMISO" });
    }
  });

  it("motivo obligatorio con registros en C, en I o en E; opcional sin registros y para una ficha sin cuenta", async () => {
    await conReloj(MOMENTO, async () => {
      const enC = await nuevoAlumno();
      await crearInscripcionDePrueba(db, { turnoId: (await crearTurnoDePrueba(db, { enDias: -2 })).idTurno, alumnoId: enC.alumnoId });

      const enI = await nuevoAlumno();
      const futura = await crearInscripcionDePrueba(db, { turnoId: (await crearTurnoDePrueba(db, { enDias: 2 })).idTurno, alumnoId: enI.alumnoId });
      await crearOperacionDePrueba(db, { cajaId, inscripcionIds: [futura.idInscripcion] });

      const enE = await nuevoAlumno();
      await crearClaseDictadaDePrueba(db, { turnoId: (await crearTurnoDePrueba(db, { enDias: -4 })).idTurno, alumnos: [{ alumnoId: enE.alumnoId, estado: "AUSENTE" }] });

      for (const { alumnoId } of [enC, enI, enE]) {
        expect((await obtenerImpactoBajaAlumno(alumnoId)).motivo_obligatorio).toBe(true);
        await expect(darBaja(alumnoId)).rejects.toMatchObject({ code: "MOTIVO_REQUERIDO" });
      }

      const sinRegistros = await nuevoAlumno();
      expect(await obtenerImpactoBajaAlumno(sinRegistros.alumnoId)).toMatchObject({ motivo_obligatorio: false, total: 0 });
      expect(await darBaja(sinRegistros.alumnoId)).toMatchObject({ activo: false, inscripciones_quitadas: 0 });
    });
  });

  it("corte horario del centro: una clase que empieza en 2 h no es registro; una que empezó hace 1 h sí", async () => {
    await conReloj(MOMENTO, async () => {
      const proxima = await nuevoAlumno();
      const clase = await crearTurnoDePrueba(db, { enDias: 0, hora: "14:00" });
      await crearInscripcionDePrueba(db, { turnoId: clase.idTurno, alumnoId: proxima.alumnoId });
      const impacto = await obtenerImpactoBajaAlumno(proxima.alumnoId);
      expect(impacto).toMatchObject({ motivo_obligatorio: false, total: 1 });
      expect(await darBaja(proxima.alumnoId)).toMatchObject({ inscripciones_quitadas: 1 });

      const empezada = await nuevoAlumno();
      await crearInscripcionDePrueba(db, { turnoId: (await crearTurnoDePrueba(db, { enDias: 0, hora: "11:00" })).idTurno, alumnoId: empezada.alumnoId });
      expect(await obtenerImpactoBajaAlumno(empezada.alumnoId)).toMatchObject({ motivo_obligatorio: true, total: 0 });
    });
  });

  it("un fallo posterior a desactivar la cuenta revierte ficha, inscripciones, cuenta e historial", async () => {
    await conReloj(MOMENTO, async () => {
      const { alumnoId, usuarioId } = await nuevoAlumno(true);
      const ins = await crearInscripcionDePrueba(db, { turnoId: (await crearTurnoDePrueba(db, { enDias: 2 })).idTurno, alumnoId });
      const original = cuentas.desactivarCuenta;
      const fallo = vi.spyOn(cuentas, "desactivarCuenta").mockImplementationOnce(async (tx, id) => {
        await original(tx, id);
        throw new Error("fallo inyectado después de la cuenta");
      });
      try { await expect(darBaja(alumnoId)).rejects.toThrow("fallo inyectado"); } finally { fallo.mockRestore(); }
      expect(await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumnoId } })).toMatchObject({ activoAlumno: true, version: 0 });
      expect((await inscripcion(ins.idInscripcion)).vigencia).toBe("VIGENTE");
      expect(await db.usuario.findUniqueOrThrow({ where: { idUsuario: usuarioId! } })).toMatchObject({ activoUsuario: true, sesionesValidasDesdeUsuario: null });
      expect(await listarHistorialEstados("ALUMNO", alumnoId)).toHaveLength(0);
    });
  });

  describe("historial de estados: después del commit, nunca dentro de la transacción", () => {
    const filasDeHistorial = (alumnoId: string) => db.historialEstado.count({ where: { entidad: "ALUMNO", entidadId: alumnoId } });

    it("un fallo después de encolar el historial y antes del commit revierte la baja y no deja ninguna fila de historial", async () => {
      await conReloj(MOMENTO, async () => {
        const { alumnoId, usuarioId } = await nuevoAlumno(true);
        const ins = await crearInscripcionDePrueba(db, { turnoId: (await crearTurnoDePrueba(db, { enDias: 2 })).idTurno, alumnoId });
        const original = historialEstados.registrarCambioEstado;
        const fallo = vi.spyOn(historialEstados, "registrarCambioEstado").mockImplementationOnce((tx, cambio) => {
          expect(original(tx, cambio).id).toBeTruthy(); // el historial ya está encolado
          throw new Error("fallo inyectado después de encolar el historial");
        });
        let inyecciones = 0;
        try {
          await expect(darBaja(alumnoId)).rejects.toThrow("fallo inyectado después de encolar");
          inyecciones = fallo.mock.calls.length;
        } finally { fallo.mockRestore(); }
        expect(inyecciones).toBe(1);
        expect(await filasDeHistorial(alumnoId)).toBe(0);
        expect(await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumnoId } })).toMatchObject({ activoAlumno: true, version: 0 });
        expect((await inscripcion(ins.idInscripcion)).vigencia).toBe("VIGENTE");
        expect(await db.historialInscripcion.count({ where: { inscripcionId: ins.idInscripcion, vigenciaNueva: "BAJA_ALUMNO" } })).toBe(0);
        expect(await db.usuario.findUniqueOrThrow({ where: { idUsuario: usuarioId! } })).toMatchObject({ activoUsuario: true, sesionesValidasDesdeUsuario: null });
      });
    });

    it("la fila se escribe cuando la baja ya es visible desde otra conexión, no antes", async () => {
      const { alumnoId } = await nuevoAlumno();
      const original = prisma.historialEstado.createMany.bind(prisma.historialEstado);
      const visibles: boolean[] = [];
      const escritor = vi.spyOn(prisma.historialEstado, "createMany").mockImplementation(((args: Parameters<typeof original>[0]) =>
        db.alumno.findUniqueOrThrow({ where: { idAlumno: alumnoId } }).then((ficha) => {
          visibles.push(!ficha.activoAlumno);
          return original(args);
        })) as unknown as typeof prisma.historialEstado.createMany);
      try { await darBaja(alumnoId); } finally { escritor.mockRestore(); }
      expect(visibles).toEqual([true]);
      expect(await filasDeHistorial(alumnoId)).toBe(1);
    });

    it("si el escritor falla después del commit, la baja persiste y el historial se reintenta hasta escribirse", async () => {
      const { alumnoId } = await nuevoAlumno();
      const escritor = vi.spyOn(prisma.historialEstado, "createMany")
        .mockRejectedValueOnce(new Error("fallo del escritor 1"))
        .mockRejectedValueOnce(new Error("fallo del escritor 2"));
      let intentos = 0;
      try {
        await expect(darBaja(alumnoId)).resolves.toMatchObject({ activo: false });
        intentos = escritor.mock.calls.length;
      } finally { escritor.mockRestore(); }
      expect(intentos).toBe(3);
      expect((await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumnoId } })).activoAlumno).toBe(false);
      expect(await listarHistorialEstados("ALUMNO", alumnoId)).toEqual([expect.objectContaining({ accion: "DESACTIVAR", usuario_id: mesa })]);
    });

    it("si el escritor falla siempre, agota los reintentos, registra el error y la baja no se deshace", async () => {
      const { alumnoId, usuarioId } = await nuevoAlumno(true);
      const consola = vi.spyOn(console, "error").mockImplementation(() => {});
      const escritor = vi.spyOn(prisma.historialEstado, "createMany").mockRejectedValue(new Error("base sin respuesta"));
      let intentos = 0;
      try {
        await expect(darBaja(alumnoId)).resolves.toMatchObject({ activo: false });
        intentos = escritor.mock.calls.length;
        expect(consola).toHaveBeenCalledWith("[historial] no se pudo registrar", expect.objectContaining({ tipo: "ESTADO", intentos: REINTENTOS_HISTORIAL + 1, error: "base sin respuesta" }));
      } finally { escritor.mockRestore(); consola.mockRestore(); }
      expect(intentos).toBe(REINTENTOS_HISTORIAL + 1);
      expect(await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumnoId } })).toMatchObject({ activoAlumno: false, version: 1 });
      expect((await db.usuario.findUniqueOrThrow({ where: { idUsuario: usuarioId! } })).activoUsuario).toBe(false);
      expect(await filasDeHistorial(alumnoId)).toBe(0);
    });
  });

  it("historial_estados del detalle: del más reciente al más antiguo, con el usuario resuelto y la fecha con el offset del centro", async () => {
    const integrante = await crearFichaMesaEntradaDePrueba(db);
    const actorFicha = actorUsuario(integrante.usuarioId!);
    const { alumnoId } = await nuevoAlumno();
    await conReloj(new Date("2026-10-05T15:00:00.000Z"), () => desactivarAlumno(alumnoId, { version: 0, motivo: "Se mudó" }, actorFicha));
    await conReloj(new Date("2026-10-12T17:03:00.000Z"), () => reactivarAlumno(alumnoId, { version: 1 }, actorFicha));
    const usuario = { id: integrante.usuarioId!, nombre_para_mostrar: `${integrante.apellidoFichaMesaEntrada}, Integrante` };
    expect(await obtenerHistorialEstadosAlumno(alumnoId)).toEqual([
      { fecha: "2026-10-12T14:03:00-03:00", accion: "REACTIVAR", usuario, motivo: null },
      { fecha: "2026-10-05T12:00:00-03:00", accion: "DESACTIVAR", usuario, motivo: "Se mudó" },
    ]);
  });

  it("la baja no bloquea ni toca las clases pasadas o en curso: su reserva vencida sin marcar queda intacta y la de una clase futura se marca", async () => {
    await conReloj(MOMENTO, async () => {
      const { alumnoId } = await nuevoAlumno();
      const pasada = await crearTurnoDePrueba(db, { enDias: -3 });
      const enCurso = await crearTurnoDePrueba(db, { enDias: 0, hora: "11:30" });
      const futuraVencida = await crearTurnoDePrueba(db, { enDias: 7 });
      const futuraVigente = await crearTurnoDePrueba(db, { enDias: 8 });
      const reservadaHaceDosDias = new Date(MOMENTO.getTime() - 48 * HORA);
      const iPasada = await crearInscripcionDePrueba(db, { turnoId: pasada.idTurno, alumnoId, estadoPago: "RESERVADA", reservadaEl: new Date(MOMENTO.getTime() - 120 * HORA) });
      const iEnCurso = await crearInscripcionDePrueba(db, { turnoId: enCurso.idTurno, alumnoId, estadoPago: "RESERVADA", reservadaEl: reservadaHaceDosDias });
      const iFuturaVencida = await crearInscripcionDePrueba(db, { turnoId: futuraVencida.idTurno, alumnoId, estadoPago: "RESERVADA", reservadaEl: reservadaHaceDosDias });
      const iFuturaVigente = await crearInscripcionDePrueba(db, { turnoId: futuraVigente.idTurno, alumnoId, estadoPago: "RESERVADA", reservadaEl: MOMENTO });
      for (const vencida of [iPasada, iEnCurso, iFuturaVencida]) expect(vencida.venceEl!.getTime()).toBeLessThanOrEqual(MOMENTO.getTime());
      const intactasAntes = [await inscripcion(iPasada.idInscripcion), await inscripcion(iEnCurso.idInscripcion)];
      // Paridad con la confirmación: el impacto lista exactamente lo que la baja va a quitar.
      expect((await obtenerImpactoBajaAlumno(alumnoId)).inscripciones_futuras.map((i) => i.inscripcion_id)).toEqual([iFuturaVigente.idInscripcion]);

      const bloqueo = vi.spyOn(bloqueos, "bloquear");
      let resultado;
      let clasesBloqueadas: readonly string[] = [];
      try {
        resultado = await darBaja(alumnoId, 0, "Se mudó");
        clasesBloqueadas = bloqueo.mock.calls.flatMap(([, solicitud]) => solicitud.clases ?? []);
      } finally { bloqueo.mockRestore(); }

      expect(clasesBloqueadas).toEqual(expect.arrayContaining([futuraVencida.idTurno, futuraVigente.idTurno]));
      expect(clasesBloqueadas).not.toContain(pasada.idTurno);
      expect(clasesBloqueadas).not.toContain(enCurso.idTurno);
      expect(resultado).toMatchObject({ inscripciones_quitadas: 1 });
      expect([await inscripcion(iPasada.idInscripcion), await inscripcion(iEnCurso.idInscripcion)]).toEqual(intactasAntes);
      expect(intactasAntes.map((i) => i.vigencia)).toEqual(["VIGENTE", "VIGENTE"]);
      expect(await db.historialInscripcion.count({ where: { inscripcionId: { in: [iPasada.idInscripcion, iEnCurso.idInscripcion] } } })).toBe(0);
      expect(await inscripcion(iFuturaVencida.idInscripcion)).toMatchObject({ vigencia: "RESERVA_VENCIDA", finalizadaPorActorTipo: "PROCESO_AUTOMATICO" });
      expect(await inscripcion(iFuturaVigente.idInscripcion)).toMatchObject({ vigencia: "BAJA_ALUMNO", finalizadaPorUsuarioId: mesa });
    });
  });

  it("reactivación: cuenta activa sin restaurar sesiones ni inscripciones, marca conservada, vuelve a inscribirse e historial completo", async () => {
    await conReloj(MOMENTO, async () => {
      const { alumnoId, usuarioId } = await nuevoAlumno(true);
      await db.usuario.update({ where: { idUsuario: usuarioId! }, data: { debeCambiarPasswordUsuario: true } });
      const clase = await crearTurnoDePrueba(db, { enDias: 2 });
      const ins = await crearInscripcionDePrueba(db, { turnoId: clase.idTurno, alumnoId });
      await darBaja(alumnoId);
      const baja = await db.usuario.findUniqueOrThrow({ where: { idUsuario: usuarioId! } });

      await expect(reactivarAlumno(alumnoId, { version: 0 }, actor())).rejects.toMatchObject({ code: "CONFLICTO_EDICION_CONCURRENTE" });
      expect(await reactivarAlumno(alumnoId, { version: 1 }, actor())).toEqual({ id: alumnoId, activo: true, version: 2 });
      await expect(reactivarAlumno(alumnoId, { version: 2 }, actor())).rejects.toMatchObject({ code: "ALUMNO_YA_ACTIVO" });

      const alta = await db.usuario.findUniqueOrThrow({ where: { idUsuario: usuarioId! } });
      expect(alta).toMatchObject({ activoUsuario: true, debeCambiarPasswordUsuario: true });
      expect(alta.sesionesValidasDesdeUsuario).toEqual(baja.sesionesValidasDesdeUsuario);
      expect((await inscripcion(ins.idInscripcion)).vigencia).toBe("BAJA_ALUMNO");

      const otra = await crearTurnoDePrueba(db, { enDias: 4 });
      await expect(agregarAlumnoTurno(otra.idTurno, { alumno_id: alumnoId }, mesa)).resolves.toMatchObject({ alumno_id: alumnoId });
      expect((await listarHistorialEstados("ALUMNO", alumnoId)).map((h) => h.accion).sort()).toEqual(["DESACTIVAR", "REACTIVAR"]);
    });
  });

  describe("concurrencia con intercalado forzado (dos conexiones: una retiene el bloqueo y la otra espera en la base)", () => {
    it("alta del centro y autoservicio contra la baja — gana la baja: las dos altas, que ya habían leído al alumno activo, son rechazadas", async () => {
      const { alumnoId, usuarioId } = await nuevoAlumno(true);
      const claseMesa = await crearTurnoDePrueba(db, { enDias: 2 });
      const claseAuto = await crearTurnoDePrueba(db, { enDias: 4 });
      const [baja, mesaR, autoR] = await intercalar(
        () => darBaja(alumnoId),
        () => agregarAlumnoTurno(claseMesa.idTurno, { alumno_id: alumnoId }, mesa),
        () => solicitarTurnoPropio(claseAuto.idTurno, usuarioId!),
      );
      expect(baja.status).toBe("fulfilled");
      expect(mesaR).toMatchObject({ status: "rejected", reason: { code: "ALUMNO_NO_DISPONIBLE" } });
      expect(autoR).toMatchObject({ status: "rejected", reason: { code: "ALUMNO_INACTIVO" } });
      expect(await db.turnoAlumno.count({ where: { alumnoId } })).toBe(0);
    });

    it("alta del centro contra la baja — gana el alta (reserva de HU-C-24): la baja la encuentra y la quita junto con las demás", async () => {
      const { alumnoId } = await nuevoAlumno();
      const previa = await crearInscripcionDePrueba(db, { turnoId: (await crearTurnoDePrueba(db, { enDias: 3 })).idTurno, alumnoId });
      const clase = await crearTurnoDePrueba(db, { enDias: 2 });
      const [alta, baja] = await intercalar(
        () => agregarAlumnoTurno(clase.idTurno, { alumno_id: alumnoId }, mesa),
        () => darBaja(alumnoId),
      );
      expect(alta).toMatchObject({ status: "fulfilled", value: { alumno_id: alumnoId } });
      expect(baja).toMatchObject({ status: "fulfilled", value: { inscripciones_quitadas: 2 } });
      expect(await db.turnoAlumno.count({ where: { alumnoId, vigencia: "VIGENTE" } })).toBe(0);
      expect(await db.turnoAlumno.count({ where: { alumnoId, vigencia: "BAJA_ALUMNO" } })).toBe(2);
      expect((await inscripcion(previa.idInscripcion)).vigencia).toBe("BAJA_ALUMNO");
    });

    it("alta de «Registrar pago» (excepción de HU-C-24) contra la baja — gana la baja: el pago se rechaza y no se crea ninguna inscripción", async () => {
      const { alumnoId } = await nuevoAlumno();
      const clase = await crearTurnoDePrueba(db, { enDias: 6 });
      // Reserva que venció sin pagar: desde ahí la inscripción en esta clase solo se crea al cobrar.
      await crearInscripcionDePrueba(db, { turnoId: clase.idTurno, alumnoId, estadoPago: "RESERVADA", reservadaEl: new Date(Date.now() - 48 * HORA) });
      const cobrador = await cobradorConCaja();
      const [baja, cobro] = await intercalar(
        () => darBaja(alumnoId, 0, "Baja antes del cobro"),
        () => cobrar(cobrador, alumnoId, { crearInscripcion: { turnoId: clase.idTurno }, monto: "12000" }),
      );
      expect(baja.status).toBe("fulfilled");
      expect(cobro).toMatchObject({ status: "rejected", reason: { code: "ALUMNO_INACTIVO" } });
      expect(await db.turnoAlumno.findMany({ where: { alumnoId }, select: { vigencia: true } })).toEqual([{ vigencia: "RESERVA_VENCIDA" }]);
      expect(await db.pago.count({ where: { alumnoId } })).toBe(0);
    });

    it("alta de «Registrar pago» (excepción de HU-C-24) contra la baja — gana el pago: la inscripción nace pagada, la baja la quita y el pago queda intacto", async () => {
      const { alumnoId } = await nuevoAlumno();
      const clase = await crearTurnoDePrueba(db, { enDias: 6 });
      await crearInscripcionDePrueba(db, { turnoId: clase.idTurno, alumnoId, estadoPago: "RESERVADA", reservadaEl: new Date(Date.now() - 48 * HORA) });
      const cobrador = await cobradorConCaja();
      const [cobro, baja] = await intercalar(
        () => cobrar(cobrador, alumnoId, { crearInscripcion: { turnoId: clase.idTurno }, monto: "12000" }),
        () => darBaja(alumnoId, 0, "Baja después del cobro"),
      );
      expect(cobro.status).toBe("fulfilled");
      expect(baja).toMatchObject({ status: "fulfilled", value: { inscripciones_quitadas: 1 } });
      const pagos = await db.pago.findMany({ where: { alumnoId } });
      expect(pagos).toHaveLength(1);
      expect(await inscripcion(pagos[0]!.inscripcionId)).toMatchObject({ vigencia: "BAJA_ALUMNO", estadoPago: "PAGADA" });
      expect(await db.anulacionPago.count({ where: { pagoId: pagos[0]!.idPago } })).toBe(0);
    });

    it("cobro de HU-I-10 contra la baja — gana la baja: el cobro se rechaza y no queda ningún pago", async () => {
      const { alumnoId } = await nuevoAlumno();
      const ins = await crearInscripcionDePrueba(db, { turnoId: (await crearTurnoDePrueba(db, { enDias: 2 })).idTurno, alumnoId });
      const cobrador = await cobradorConCaja();
      const [baja, cobro] = await intercalar(
        () => darBaja(alumnoId, 0, "Baja antes del cobro"),
        () => cobrar(cobrador, alumnoId, { inscripcionId: ins.idInscripcion, monto: "12000" }),
      );
      expect(baja.status).toBe("fulfilled");
      expect(cobro).toMatchObject({ status: "rejected", reason: { code: "ALUMNO_NO_INSCRIPTO" } });
      expect(await inscripcion(ins.idInscripcion)).toMatchObject({ vigencia: "BAJA_ALUMNO", estadoPago: "PAGO_SIN_REGISTRAR" });
      expect(await db.pago.count({ where: { alumnoId } })).toBe(0);
    });

    it("cobro de HU-I-10 contra la baja — gana el cobro: la baja quita la inscripción pagada y el pago queda intacto", async () => {
      const { alumnoId } = await nuevoAlumno();
      const ins = await crearInscripcionDePrueba(db, { turnoId: (await crearTurnoDePrueba(db, { enDias: 2 })).idTurno, alumnoId });
      const cobrador = await cobradorConCaja();
      const [cobro, baja] = await intercalar(
        () => cobrar(cobrador, alumnoId, { inscripcionId: ins.idInscripcion, monto: "12000" }),
        () => darBaja(alumnoId, 0, "Baja después del cobro"),
      );
      expect(cobro.status).toBe("fulfilled");
      expect(baja).toMatchObject({ status: "fulfilled", value: { inscripciones_quitadas: 1 } });
      const pagos = await db.pago.findMany({ where: { inscripcionId: ins.idInscripcion } });
      expect(pagos).toHaveLength(1);
      expect(await inscripcion(ins.idInscripcion)).toMatchObject({ vigencia: "BAJA_ALUMNO", estadoPago: "PAGADA" });
      expect(await db.anulacionPago.count({ where: { pagoId: pagos[0]!.idPago } })).toBe(0);
    });

    describe("continuar la configuración de una clase Pendiente (HU-C-18)", () => {
      /** Clase Pendiente lista para confirmar: profesor que dicta la materia y atiende ese día, aula con cupo. */
      async function pendienteConfirmable() {
        const materia = await crearMateriaDePrueba(db);
        const profesor = await crearProfesorDePrueba(db);
        const aula = await crearAulaDePrueba(db, { capacidad: 10 });
        const clase = await crearTurnoDePrueba(db, { enDias: 4, estado: "PENDIENTE", materiaId: materia.idMateria, profesorId: profesor.idProfesor, aulaId: aula.idAula });
        await db.profesorMateria.create({ data: { profesorId: profesor.idProfesor, materiaId: materia.idMateria } });
        const dia = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"] as const;
        await db.horarioProfesor.create({ data: {
          profesorId: profesor.idProfesor, diaSemanaHorario: dia[clase.fechaTurno.getUTCDay()]!,
          horaDesdeHorario: new Date("1970-01-01T08:00:00Z"), horaHastaHorario: new Date("1970-01-01T20:00:00Z"),
        } });
        return clase;
      }

      it("gana la baja: el alumno ya inactivo es rechazado (ALUMNO_INACTIVO) y la clase sigue Pendiente sin inscripciones", async () => {
        const { alumnoId } = await nuevoAlumno();
        const clase = await pendienteConfirmable();
        const [baja, confirmacion] = await intercalar(
          () => darBaja(alumnoId),
          () => asignarParticipantesTurno(clase.idTurno, { alumno_ids: [alumnoId] }, mesa),
        );
        expect(baja.status).toBe("fulfilled");
        expect(confirmacion).toMatchObject({ status: "rejected", reason: { code: "ALUMNO_INACTIVO" } });
        expect((await db.turno.findUniqueOrThrow({ where: { idTurno: clase.idTurno } })).estadoTurno).toBe("PENDIENTE");
        expect(await db.turnoAlumno.count({ where: { alumnoId } })).toBe(0);
      });

      it("gana la confirmación: la clase queda Disponible con el alumno reservado y la baja lo quita", async () => {
        const { alumnoId } = await nuevoAlumno();
        const clase = await pendienteConfirmable();
        const [confirmacion, baja] = await intercalar(
          () => asignarParticipantesTurno(clase.idTurno, { alumno_ids: [alumnoId] }, mesa),
          () => darBaja(alumnoId),
        );
        expect(confirmacion).toMatchObject({ status: "fulfilled", value: { estado: "DISPONIBLE" } });
        expect(baja).toMatchObject({ status: "fulfilled", value: { inscripciones_quitadas: 1 } });
        expect((await db.turno.findUniqueOrThrow({ where: { idTurno: clase.idTurno } })).estadoTurno).toBe("DISPONIBLE");
        expect(await db.turnoAlumno.findMany({ where: { alumnoId }, select: { vigencia: true } })).toEqual([{ vigencia: "BAJA_ALUMNO" }]);
      });
    });

    it("baja contra reactivación — gana la baja: la reactivación, que partía de la versión anterior, recibe CONFLICTO_EDICION_CONCURRENTE", async () => {
      const { alumnoId } = await nuevoAlumno();
      const [baja, reactivacion] = await intercalar(
        () => darBaja(alumnoId, 0),
        () => reactivarAlumno(alumnoId, { version: 0 }, actor()),
      );
      expect(baja).toMatchObject({ status: "fulfilled", value: { activo: false, version: 1 } });
      expect(reactivacion).toMatchObject({ status: "rejected", reason: { code: "CONFLICTO_EDICION_CONCURRENTE" } });
      expect(await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumnoId } })).toMatchObject({ activoAlumno: false, version: 1 });
      expect((await listarHistorialEstados("ALUMNO", alumnoId)).map((h) => h.accion)).toEqual(["DESACTIVAR"]);
    });

    it("baja contra reactivación — gana la reactivación: la baja, que partía de la versión anterior, recibe CONFLICTO_EDICION_CONCURRENTE", async () => {
      const { alumnoId } = await nuevoAlumno();
      await darBaja(alumnoId, 0);
      const [reactivacion, baja] = await intercalar(
        () => reactivarAlumno(alumnoId, { version: 1 }, actor()),
        () => darBaja(alumnoId, 1),
      );
      expect(reactivacion).toMatchObject({ status: "fulfilled", value: { activo: true, version: 2 } });
      expect(baja).toMatchObject({ status: "rejected", reason: { code: "CONFLICTO_EDICION_CONCURRENTE" } });
      expect(await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumnoId } })).toMatchObject({ activoAlumno: true, version: 2 });
      expect((await listarHistorialEstados("ALUMNO", alumnoId)).map((h) => h.accion)).toEqual(["REACTIVAR", "DESACTIVAR"]);
    });

    it("dos bajas con la misma versión — gana la primera: la segunda recibe ALUMNO_YA_INACTIVO y el historial tiene una sola baja", async () => {
      const { alumnoId } = await nuevoAlumno();
      const [primera, segunda] = await intercalar(() => darBaja(alumnoId, 0), () => darBaja(alumnoId, 0));
      expect(primera.status).toBe("fulfilled");
      expect(segunda).toMatchObject({ status: "rejected", reason: { code: "ALUMNO_YA_INACTIVO" } });
      expect(await listarHistorialEstados("ALUMNO", alumnoId)).toHaveLength(1);
    });

    it("inscripción y baja simultáneas sin pausa: nunca quedan las dos", async () => {
      const { alumnoId } = await nuevoAlumno();
      const clase = await crearTurnoDePrueba(db, { enDias: 2 });
      const [inscripta, baja] = await Promise.allSettled([agregarAlumnoTurno(clase.idTurno, { alumno_id: alumnoId }, mesa), darBaja(alumnoId)]);
      expect(baja.status).toBe("fulfilled");
      expect(await db.turnoAlumno.count({ where: { alumnoId, vigencia: "VIGENTE" } })).toBe(0);
      if (inscripta.status === "fulfilled") expect(await db.turnoAlumno.count({ where: { alumnoId, vigencia: "BAJA_ALUMNO" } })).toBe(1);
      else expect(inscripta.reason).toMatchObject({ code: "ALUMNO_NO_DISPONIBLE" });
    });

    it("dos bajas simultáneas sin pausa: una confirma y se escribe un solo historial", async () => {
      const { alumnoId } = await nuevoAlumno();
      const resultados = await Promise.allSettled([darBaja(alumnoId), darBaja(alumnoId)]);
      expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rechazo = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(["ALUMNO_YA_INACTIVO", "CONFLICTO_EDICION_CONCURRENTE"]).toContain(rechazo.reason.code);
      expect(await listarHistorialEstados("ALUMNO", alumnoId)).toHaveLength(1);
    });
  });

  describe("autorregistro con ficha inactiva", () => {
    const hmac = (codigo: string) => createHmac("sha256", process.env.CODIGO_OTP_SECRET!).update(codigo).digest("hex");
    const datosRegistro = (dni: string, email: string) => ({
      nombre: "Ana", apellido: "Baja", dni, fecha_nacimiento: new Date("2000-01-01T00:00:00.000Z"), genero: undefined, telefono: undefined,
      email, password: "Abcdefg1", confirmacion_password: "Abcdefg1", acepta_terminos: true as const,
    });
    const ip = () => `10.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

    it("con y sin cuenta: CUENTA_YA_EXISTE sin código ni cuenta", async () => {
      for (const conCuenta of [false, true]) {
        const { alumnoId } = await nuevoAlumno(conCuenta);
        const email = `${unico("auto")}@prueba.local`;
        const ficha = await db.alumno.update({ where: { idAlumno: alumnoId }, data: { emailAlumno: email } });
        await darBaja(alumnoId);
        await expect(iniciarAutorregistro(datosRegistro(ficha.dniAlumno, email), ip())).rejects.toMatchObject({ code: "CUENTA_YA_EXISTE" });
        expect(await db.solicitudAutorregistro.count({ where: { alumnoId } })).toBe(0);
        expect(await db.usuario.count({ where: { emailUsuario: email } })).toBe(0);
      }
    });

    it("código pedido con la ficha activa y confirmado después de la baja: CUENTA_YA_EXISTE y ninguna cuenta vinculada", async () => {
      const { alumnoId } = await nuevoAlumno();
      const email = `${unico("auto")}@prueba.local`;
      const ficha = await db.alumno.update({ where: { idAlumno: alumnoId }, data: { emailAlumno: email } });
      const inicio = await iniciarAutorregistro(datosRegistro(ficha.dniAlumno, email), ip());
      expect(inicio.via).toBe("VERIFICACION_REQUERIDA");
      const solicitudId = (inicio as { solicitud_id: string }).solicitud_id;
      const solicitud = await db.solicitudAutorregistro.findUniqueOrThrow({ where: { idSolicitud: solicitudId } });
      await db.codigoVerificacion.update({ where: { idCodigo: solicitud.codigoId }, data: { codigoHash: hmac("123456") } });

      await darBaja(alumnoId);
      await expect(confirmarCodigoAutorregistro(solicitudId, "123456", ip())).rejects.toMatchObject({ code: "CUENTA_YA_EXISTE" });
      expect(await db.usuario.count({ where: { emailUsuario: { equals: email, mode: "insensitive" } } })).toBe(0);
      expect((await db.alumno.findUniqueOrThrow({ where: { idAlumno: alumnoId } })).usuarioId).toBeNull();
      expect((await db.solicitudAutorregistro.findUniqueOrThrow({ where: { idSolicitud: solicitudId } })).confirmadaEn).toBeNull();
    });

    const CUENTA_YA_EXISTE = "Ya existe una cuenta con esos datos. Iniciá sesión o solicitá asistencia en mesa de entrada.";
    const dniLibre = () => `9${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    const conteos = async () => ({
      alumnos: await db.alumno.count(), usuarios: await db.usuario.count(),
      solicitudes: await db.solicitudAutorregistro.count(), codigos: await db.codigoVerificacion.count(),
    });
    /** Ficha sin cuenta (o con cuenta) cuyo email de contacto es `email`; opcionalmente ya dada de baja. */
    async function fichaConEmailDeContacto({ inactiva, conCuenta = false, email = `${unico("auto")}@prueba.local` }: { inactiva: boolean; conCuenta?: boolean; email?: string }) {
      const { alumnoId, usuarioId } = await nuevoAlumno(conCuenta);
      const ficha = await db.alumno.update({ where: { idAlumno: alumnoId }, data: { emailAlumno: email } });
      if (inactiva) await darBaja(alumnoId);
      return { alumnoId, usuarioId, dni: ficha.dniAlumno, email };
    }
    /** Solicitud de autorregistro con un código conocido ("123456") sobre una ficha activa sin cuenta. */
    async function solicitudConCodigo() {
      const ficha = await fichaConEmailDeContacto({ inactiva: false });
      const inicio = await iniciarAutorregistro(datosRegistro(ficha.dni, ficha.email), ip());
      expect(inicio.via).toBe("VERIFICACION_REQUERIDA");
      const solicitudId = (inicio as { solicitud_id: string }).solicitud_id;
      const solicitud = await db.solicitudAutorregistro.findUniqueOrThrow({ where: { idSolicitud: solicitudId } });
      await db.codigoVerificacion.update({ where: { idCodigo: solicitud.codigoId }, data: { codigoHash: hmac("123456") } });
      return { ...ficha, solicitudId };
    }

    describe("email de contacto de una ficha inactiva (criterio 5)", () => {
      it.each([
        ["sin cuenta", false, undefined],
        ["con cuenta", true, undefined],
        ["con el email guardado en otra capitalización", false, `Mixto.${unico("Auto")}@Prueba.Local`],
      ])("ficha inactiva %s + autorregistro con OTRO DNI y su email: CUENTA_YA_EXISTE y cero filas nuevas", async (_caso, conCuenta, email) => {
        const ficha = await fichaConEmailDeContacto({ inactiva: true, conCuenta, email });
        const antes = await conteos();
        const error = await iniciarAutorregistro(datosRegistro(dniLibre(), ficha.email.toLowerCase()), ip()).catch((e) => e);
        expect(error).toMatchObject({ code: "CUENTA_YA_EXISTE", message: CUENTA_YA_EXISTE });
        expect(await conteos()).toEqual(antes);
        expect(await db.alumno.findUniqueOrThrow({ where: { idAlumno: ficha.alumnoId } })).toMatchObject({ activoAlumno: false, usuarioId: ficha.usuarioId });
      });

      it("el rechazo es idéntico al de la rama (c): mismo code y mismo mensaje", async () => {
        const inactiva = await fichaConEmailDeContacto({ inactiva: true });
        const conCuenta = await fichaConEmailDeContacto({ inactiva: false, conCuenta: true });
        const porEmail = await iniciarAutorregistro(datosRegistro(dniLibre(), inactiva.email), ip()).catch((e) => e);
        const ramaC = await iniciarAutorregistro(datosRegistro(conCuenta.dni, `${unico("otro")}@prueba.local`), ip()).catch((e) => e);
        expect({ code: porEmail.code, message: porEmail.message }).toEqual({ code: ramaC.code, message: ramaC.message });
      });

      it("también cuando el DNI tipeado es de una ficha activa sin cuenta que comparte ese email (rama b): no se genera código ni se envía nada", async () => {
        const email = `${unico("auto")}@prueba.local`;
        await fichaConEmailDeContacto({ inactiva: true, email });
        const activa = await fichaConEmailDeContacto({ inactiva: false, email });
        const antes = await conteos();
        const error = await iniciarAutorregistro(datosRegistro(activa.dni, email), ip()).catch((e) => e);
        expect(error).toMatchObject({ code: "CUENTA_YA_EXISTE", message: CUENTA_YA_EXISTE });
        expect(await conteos()).toEqual(antes);
      });

      it("con una ficha ACTIVA con ese email y otro DNI el autorregistro sigue como en el Sprint 1: alta directa de ficha y cuenta", async () => {
        const activa = await fichaConEmailDeContacto({ inactiva: false });
        const antes = await conteos();
        const dni = dniLibre();
        await expect(iniciarAutorregistro(datosRegistro(dni, activa.email), ip())).resolves.toEqual({ via: "DIRECTO", email: activa.email });
        expect(await conteos()).toEqual({ ...antes, alumnos: antes.alumnos + 1, usuarios: antes.usuarios + 1 });
        expect(await db.alumno.findFirstOrThrow({ where: { dniAlumno: dni } })).toMatchObject({ activoAlumno: true, emailAlumno: activa.email });
      });

      it("baja concurrente: la ficha se da de baja mientras el alta directa espera en la base — la relectura dentro de la transacción la rechaza y no crea nada", async () => {
        const ficha = await fichaConEmailDeContacto({ inactiva: false });
        const antes = await conteos();
        const dni = dniLibre();
        const [baja, registro] = await intercalar(() => darBaja(ficha.alumnoId), () => iniciarAutorregistro(datosRegistro(dni, ficha.email), ip()));
        expect(baja.status).toBe("fulfilled");
        expect(registro).toMatchObject({ status: "rejected", reason: { code: "CUENTA_YA_EXISTE", message: CUENTA_YA_EXISTE } });
        expect(await conteos()).toEqual(antes);
        expect(await db.alumno.count({ where: { dniAlumno: dni } })).toBe(0);
      });

      it("alta directa concurrente: si el autorregistro confirma primero, la baja espera y se aplica después — quedan la ficha nueva activa con su cuenta y la anterior inactiva", async () => {
        const ficha = await fichaConEmailDeContacto({ inactiva: false });
        const dni = dniLibre();
        let soltar!: () => void;
        let creada!: () => void;
        const listo = new Promise<void>((r) => { creada = r; });
        const espera = new Promise<void>((r) => { soltar = r; });
        const original = usuarios.crearCuentaConCredenciales;
        const pausa = vi.spyOn(usuarios, "crearCuentaConCredenciales").mockImplementation(async (...args: Parameters<typeof original>) => {
          const cuenta = await original(...args);
          creada();
          await espera;
          return cuenta;
        });
        try {
          const registro = iniciarAutorregistro(datosRegistro(dni, ficha.email), ip());
          await listo;
          const baja = darBaja(ficha.alumnoId);
          try { await esperarBloqueados(1); } finally { soltar(); }
          await expect(registro).resolves.toEqual({ via: "DIRECTO", email: ficha.email });
          await expect(baja).resolves.toMatchObject({ activo: false });
        } finally { pausa.mockRestore(); }
        expect(await db.alumno.findFirstOrThrow({ where: { dniAlumno: dni } })).toMatchObject({ activoAlumno: true, emailAlumno: ficha.email });
        expect(await db.usuario.count({ where: { emailUsuario: ficha.email, activoUsuario: true } })).toBe(1);
        expect((await db.alumno.findUniqueOrThrow({ where: { idAlumno: ficha.alumnoId } })).activoAlumno).toBe(false);
      });
    });

    describe("código de autorregistro confirmado contra la baja (intercalado forzado)", () => {
      it("gana la baja: la confirmación recibe CUENTA_YA_EXISTE y no se crea ni se vincula ninguna cuenta", async () => {
        const solicitud = await solicitudConCodigo();
        const [baja, confirmacion] = await intercalar(() => darBaja(solicitud.alumnoId), () => confirmarCodigoAutorregistro(solicitud.solicitudId, "123456", ip()));
        expect(baja.status).toBe("fulfilled");
        expect(confirmacion).toMatchObject({ status: "rejected", reason: { code: "CUENTA_YA_EXISTE", message: CUENTA_YA_EXISTE } });
        expect(await db.usuario.count({ where: { emailUsuario: solicitud.email } })).toBe(0);
        expect((await db.alumno.findUniqueOrThrow({ where: { idAlumno: solicitud.alumnoId } }))).toMatchObject({ activoAlumno: false, usuarioId: null });
        expect((await db.solicitudAutorregistro.findUniqueOrThrow({ where: { idSolicitud: solicitud.solicitudId } })).confirmadaEn).toBeNull();
      });

      it("gana la confirmación: la cuenta se crea y se vincula, y la baja que esperaba la deja inactiva y con las sesiones revocadas", async () => {
        const solicitud = await solicitudConCodigo();
        const [confirmacion, baja] = await intercalar(() => confirmarCodigoAutorregistro(solicitud.solicitudId, "123456", ip()), () => darBaja(solicitud.alumnoId));
        expect(baja.status).toBe("fulfilled");
        expect(confirmacion.status).toBe("fulfilled");
        const { usuario_id: usuarioId } = (confirmacion as PromiseFulfilledResult<{ usuario_id: string }>).value;
        expect(await db.alumno.findUniqueOrThrow({ where: { idAlumno: solicitud.alumnoId } })).toMatchObject({ activoAlumno: false, usuarioId });
        const cuenta = await db.usuario.findUniqueOrThrow({ where: { idUsuario: usuarioId } });
        expect(cuenta.activoUsuario).toBe(false);
        expect(cuenta.sesionesValidasDesdeUsuario).not.toBeNull();
        expect((await db.solicitudAutorregistro.findUniqueOrThrow({ where: { idSolicitud: solicitud.solicitudId } })).confirmadaEn).not.toBeNull();
        expect((await listarHistorialEstados("ALUMNO", solicitud.alumnoId)).map((h) => h.accion)).toEqual(["DESACTIVAR"]);
      });
    });
  });
});
