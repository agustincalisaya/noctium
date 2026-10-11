import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { abrirCajaDePrueba, crearInscripcionDePrueba, crearMateriaDePrueba, crearTurnoDePrueba, crearAlumnoDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { usuarioRegistroOperaciones } from "@/server/shared/actividad-usuario";
import { usuarioRegistroOperaciones as registroClases } from "@/server/turnos/turno.publico";
import { usuarioRegistroOperaciones as registroTarifas } from "@/server/materias/materia.publico";
import { usuarioRegistroCambiosDeEstado } from "@/server/shared/historial-estados";
import { ahora } from "@/server/shared/reloj";

// «Registró operaciones» (DEC-39, spec_modulo_F.md §2.7) sobre PostgreSQL
// real: cada línea por separado, con una cuenta nueva por caso.
describe.skipIf(!basePgHabilitada)("HU-F-05 actividad del usuario, PostgreSQL real", () => {
  let db: PrismaClient;
  const alumnosCreados: string[] = [];
  beforeAll(() => { db = clientePg(); });
  afterAll(async () => {
    // El seed posterior busca el primer alumno activo: estas filas pertenecen a esta suite.
    await db?.alumno.updateMany({ where: { idAlumno: { in: alumnosCreados } }, data: { activoAlumno: false } });
    await db?.$disconnect();
  });
  const cuenta = async () => (await crearUsuarioDePrueba(db, { rol: "MESA_ENTRADA" })).idUsuario;
  const registro = (usuarioId: string) => usuarioRegistroOperaciones(db, usuarioId);

  it("una cuenta sin ningún registro: false en todas las líneas", async () => {
    const u = await cuenta();
    expect(await registro(u)).toBe(false);
    expect(await registroClases(u, db)).toBe(false);
    expect(await registroTarifas(u, db)).toBe(false);
    expect(await usuarioRegistroCambiosDeEstado(u, db)).toBe(false);
  });

  it("I: una caja propia alcanza", async () => {
    const u = await cuenta();
    await abrirCajaDePrueba(db, { usuarioId: u });
    expect(await registro(u)).toBe(true);
  });

  it("C: una clase creada y otra modificada por la cuenta", async () => {
    const creador = await cuenta(), modificador = await cuenta();
    const creada = await crearTurnoDePrueba(db);
    await db.turno.update({ where: { idTurno: creada.idTurno }, data: { creadoPorUsuarioId: creador } });
    const modificada = await crearTurnoDePrueba(db);
    await db.turno.update({ where: { idTurno: modificada.idTurno }, data: { modificadoPorUsuarioId: modificador } });
    for (const u of [creador, modificador]) {
      expect(await registroClases(u, db)).toBe(true);
      expect(await registro(u)).toBe(true);
    }
  });

  it("C: una inscripción creada, una finalizada, su historial y un evento de clase", async () => {
    const [creo, finalizo, historial, evento] = await Promise.all([cuenta(), cuenta(), cuenta(), cuenta()]);
    const turno = await crearTurnoDePrueba(db);
    const alumno = await crearAlumnoDePrueba(db); alumnosCreados.push(alumno.idAlumno);
    const ins = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, creadoPorUsuarioId: creo });
    await db.turnoAlumno.update({ where: { idInscripcion: ins.idInscripcion }, data: {
      vigencia: "QUITADA_CENTRO", finalizadaEl: ahora(), finalizadaPorActorTipo: "USUARIO", finalizadaPorUsuarioId: finalizo,
    } });
    await db.historialInscripcion.create({ data: {
      inscripcionId: ins.idInscripcion, vigenciaNueva: "VIGENTE", estadoPagoNuevo: "PAGO_SIN_REGISTRAR",
      actorTipo: "USUARIO", usuarioId: historial, fecha: ahora(),
    } });
    await db.eventoTurno.create({ data: { tipoEvento: "turno:prueba", turnoId: turno.idTurno, usuarioId: evento, payloadEvento: {} } });
    for (const u of [creo, finalizo, historial, evento]) {
      expect(await registroClases(u, db)).toBe(true);
      expect(await registro(u)).toBe(true);
    }
  });

  it("L: un cambio de tarifa", async () => {
    const u = await cuenta();
    const materia = await crearMateriaDePrueba(db);
    await db.historialTarifa.create({ data: { materiaId: materia.idMateria, tarifaNueva: 15000, usuarioId: u, fecha: ahora() } });
    expect(await registroTarifas(u, db)).toBe(true);
    expect(await registro(u)).toBe(true);
  });

  it("historial de estados: una baja o reactivación de cualquier entidad", async () => {
    const u = await cuenta();
    await db.historialEstado.create({ data: {
      entidad: "PROFESOR", entidadId: "ckprofesor", accion: "DESACTIVAR", actorTipo: "USUARIO", usuarioId: u, fecha: ahora(),
    } });
    expect(await usuarioRegistroCambiosDeEstado(u, db)).toBe(true);
    expect(await registro(u)).toBe(true);
  });
});
