import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient, RolUsuario } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import {
  abrirCajaDePrueba, crearAlumnoDePrueba, crearClaseDictadaDePrueba, crearInscripcionDePrueba,
  crearOperacionDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba, unico,
} from "@/server/testing/fabricas";
import * as bloqueos from "@/server/shared/bloquear";
import * as cuentas from "@/server/usuarios/cuenta.service";
import { actorUsuario } from "@/server/shared/historial";
import { listarHistorialEstados } from "@/server/shared/historial-estados";
import { conReloj } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";
import { desactivarAlumno, obtenerImpactoBajaAlumno, reactivarAlumno } from "@/server/alumnos/alumno.estado.service";
import { confirmarCodigoAutorregistro, iniciarAutorregistro } from "@/server/alumnos/autorregistro.service";
import { verificarPermiso } from "@/server/shared/with-permission";
import { agregarAlumnoTurno, solicitarTurnoPropio } from "@/server/turnos/turno.service";
import { registrarOperacion } from "@/server/pagos/operacion.service";

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

  describe("concurrencia", () => {
    /** Pausa la primera llamada a `bloquear` (la de la baja) después de tomar el bloqueo de la ficha. */
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

    it("resultado A: gana la baja; mesa de entrada y autoservicio con alumnoActivo ya leído son rechazados", async () => {
      const { alumnoId, usuarioId } = await nuevoAlumno(true);
      const claseMesa = await crearTurnoDePrueba(db, { enDias: 2 });
      const claseAuto = await crearTurnoDePrueba(db, { enDias: 4 });
      const pausa = pausarPrimerBloqueo();
      const baja = darBaja(alumnoId);
      await pausa.listo;
      const inscripciones = Promise.allSettled([
        agregarAlumnoTurno(claseMesa.idTurno, { alumno_id: alumnoId }, mesa),
        solicitarTurnoPropio(claseAuto.idTurno, usuarioId!),
      ]);
      pausa.soltar();
      try { await baja; } finally { pausa.restaurar(); }
      const [mesaR, autoR] = await inscripciones;
      expect(mesaR).toMatchObject({ status: "rejected", reason: { code: "ALUMNO_NO_DISPONIBLE" } });
      expect(autoR).toMatchObject({ status: "rejected", reason: { code: "ALUMNO_INACTIVO" } });
      expect(await db.turnoAlumno.count({ where: { alumnoId, vigencia: "VIGENTE" } })).toBe(0);
    });

    it("resultado B: gana la inscripción y la baja la quita junto con las demás", async () => {
      const { alumnoId } = await nuevoAlumno();
      const clase = await crearTurnoDePrueba(db, { enDias: 2 });
      await agregarAlumnoTurno(clase.idTurno, { alumno_id: alumnoId }, mesa);
      expect(await darBaja(alumnoId)).toMatchObject({ inscripciones_quitadas: 1 });
      expect(await db.turnoAlumno.count({ where: { alumnoId, vigencia: "VIGENTE" } })).toBe(0);
      expect(await db.turnoAlumno.count({ where: { alumnoId, vigencia: "BAJA_ALUMNO" } })).toBe(1);
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

    it("dos bajas simultáneas: una confirma y se escribe un solo historial", async () => {
      const { alumnoId } = await nuevoAlumno();
      const resultados = await Promise.allSettled([darBaja(alumnoId), darBaja(alumnoId)]);
      expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rechazo = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(["ALUMNO_YA_INACTIVO", "CONFLICTO_EDICION_CONCURRENTE"]).toContain(rechazo.reason.code);
      expect(await listarHistorialEstados("ALUMNO", alumnoId)).toHaveLength(1);
    });

    it("baja contra cobro simultáneo (registrarOperacion de HU-I-10): sin interbloqueo y pago intacto", async () => {
      const { alumnoId } = await nuevoAlumno();
      const ins = await crearInscripcionDePrueba(db, { turnoId: (await crearTurnoDePrueba(db, { enDias: 2 })).idTurno, alumnoId });
      const cajero = (await crearUsuarioDePrueba(db, { rol: "MESA_ENTRADA" })).idUsuario;
      await abrirCajaDePrueba(db, { usuarioId: cajero });
      const nombre = unico("Efectivo B07 ");
      const forma = await db.formaPago.create({ data: { nombreFormaPago: nombre, nombreNormalizadaFormaPago: nombre.toLowerCase(), esEfectivo: true } });
      const [cobro, baja] = await Promise.allSettled([
        transaccion((tx) => registrarOperacion(tx, { alumnoId, usuarioId: cajero, modo: "completo", formaPagoId: forma.idFormaPago, items: [{ inscripcionId: ins.idInscripcion, monto: "12000" }] })),
        darBaja(alumnoId, 0, "Baja durante el cobro"),
      ]);
      for (const r of [cobro, baja]) if (r.status === "rejected") expect(r.reason.code).not.toBe("TRANSACCION_OCUPADA");
      expect(baja.status).toBe("fulfilled");
      expect((await inscripcion(ins.idInscripcion)).vigencia).toBe("BAJA_ALUMNO");
      if (cobro.status === "fulfilled") {
        expect(await db.pago.count({ where: { inscripcionId: ins.idInscripcion } })).toBe(1);
        expect((await inscripcion(ins.idInscripcion)).estadoPago).toBe("PAGADA");
      }
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
  });
});
