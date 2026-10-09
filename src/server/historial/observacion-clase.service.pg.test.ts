import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearProfesorDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { registrarClaseDictada } from "@/server/historial/clase-dictada.service";
import { leerObservacionDeClase, registrarObservacionClase } from "@/server/historial/observacion-clase.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { actorUsuario } from "@/server/shared/historial";
import { ahora } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";

describe.skipIf(!basePgHabilitada)("HU-E-07 observaciones con PostgreSQL real", () => {
  let db: PrismaClient;

  beforeAll(() => { db = clientePg(); });
  afterAll(async () => { await db?.$disconnect(); });

  async function escenario() {
    const mesa = await crearUsuarioDePrueba(db, { rol: "MESA_ENTRADA" });
    const titularUsuario = await crearUsuarioDePrueba(db, { rol: "PROFESOR" });
    const titular = await crearProfesorDePrueba(db);
    await db.profesor.update({ where: { idProfesor: titular.idProfesor }, data: { usuarioId: titularUsuario.idUsuario } });
    const ajenoUsuario = await crearUsuarioDePrueba(db, { rol: "PROFESOR" });
    const ajeno = await crearProfesorDePrueba(db);
    await db.profesor.update({ where: { idProfesor: ajeno.idProfesor }, data: { usuarioId: ajenoUsuario.idUsuario } });
    const turno = await crearTurnoDePrueba(db, { enDias: -2, profesorId: titular.idProfesor });
    const clase = await transaccion((tx) => registrarClaseDictada(tx, {
      turnoId: turno.idTurno,
      actor: actorUsuario(mesa.idUsuario),
    }), { db });
    const usuarioMesa = { id: mesa.idUsuario, rol: "MESA_ENTRADA" as const };
    const usuarioTitular = { id: titularUsuario.idUsuario, rol: "PROFESOR" as const };
    const usuarioAjeno = { id: ajenoUsuario.idUsuario, rol: "PROFESOR" as const };
    return { mesa, titularUsuario, titular, ajenoUsuario, ajeno, turno, clase, usuarioMesa, usuarioTitular, usuarioAjeno };
  }

  const entrada = { temas_vistos: "Funciones lineales y ecuaciones", observaciones_internas: "Repasar el ejercicio 4" };
  const registrar = (turnoId: string, datos: typeof entrada, usuario: { id: string; rol: "MESA_ENTRADA" | "PROFESOR" | "GERENTE" }) =>
    transaccion((tx) => registrarObservacionClase(tx, turnoId, datos, usuario), { db });

  it("persiste texto, auditoría y vínculo con la clase dictada vigente", async () => {
    const e = await escenario();
    const guardada = await registrar(e.turno.idTurno, entrada, e.usuarioMesa);
    const fila = await db.observacionClase.findUniqueOrThrow({ where: { claseDictadaId: e.clase.id } });
    expect(fila).toMatchObject({
      idObservacionClase: guardada.id,
      claseDictadaId: e.clase.id,
      temasVistos: entrada.temas_vistos,
      observacionesInternas: entrada.observaciones_internas,
      creadoPorUsuarioId: e.mesa.idUsuario,
    });
    expect(fila.createdAtObservacion.toISOString()).toBe(guardada.registrada_en);
  });

  it("permite Mesa y profesor titular, y rechaza a otro profesor o rol", async () => {
    const e = await escenario();
    await expect(registrar(e.turno.idTurno, entrada, e.usuarioTitular)).resolves.toMatchObject({ clase_dictada_id: e.clase.id });
    await expect(registrar(e.turno.idTurno, entrada, e.usuarioAjeno)).rejects.toMatchObject({ code: "SIN_PERMISO" });
    await expect(registrar(e.turno.idTurno, entrada, { id: "gerente", rol: "GERENTE" })).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });

  it("dos escrituras simultáneas respetan el bloqueo y la unicidad sin perder errores de dominio", async () => {
    const e = await escenario();
    const resultados = await Promise.allSettled([
      registrar(e.turno.idTurno, entrada, e.usuarioMesa),
      registrar(e.turno.idTurno, entrada, e.usuarioMesa),
    ]);
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    const rechazo = resultados.find((resultado) => resultado.status === "rejected");
    expect(rechazo).toMatchObject({ status: "rejected", reason: expect.any(ErrorDeDominio) });
    expect((rechazo as PromiseRejectedResult).reason.code).toBe("OBSERVACIONES_YA_REGISTRADAS");
    expect(await db.observacionClase.count({ where: { claseDictadaId: e.clase.id } })).toBe(1);
  });

  it("oculta el texto interno a otro profesor y no revela la observación de una clase anulada", async () => {
    const e = await escenario();
    await registrar(e.turno.idTurno, entrada, e.usuarioTitular);
    await expect(leerObservacionDeClase(e.clase.id, e.usuarioTitular, db)).resolves.toMatchObject({
      temas_vistos: entrada.temas_vistos, observaciones_internas: entrada.observaciones_internas,
    });
    const lecturaAjena = await leerObservacionDeClase(e.clase.id, e.usuarioAjeno, db);
    expect(lecturaAjena).toMatchObject({ temas_vistos: entrada.temas_vistos });
    expect(lecturaAjena).not.toHaveProperty("observaciones_internas");

    await db.claseDictada.update({ where: { idClaseDictada: e.clase.id }, data: {
      anuladaEl: ahora(), anuladaPorUsuarioId: e.mesa.idUsuario, motivoAnulacion: "Setup de prueba HU-E-11",
    } });
    await expect(leerObservacionDeClase(e.clase.id, e.usuarioMesa, db)).resolves.toBeNull();
  });

  it("una clase nueva del mismo turno admite su propia observación y conserva oculta la anterior", async () => {
    const e = await escenario();
    await registrar(e.turno.idTurno, entrada, e.usuarioMesa);
    await db.claseDictada.update({ where: { idClaseDictada: e.clase.id }, data: {
      anuladaEl: ahora(), anuladaPorUsuarioId: e.mesa.idUsuario, motivoAnulacion: "Setup de prueba HU-E-11",
    } });
    const nueva = await transaccion((tx) => registrarClaseDictada(tx, {
      turnoId: e.turno.idTurno,
      actor: actorUsuario(e.mesa.idUsuario),
    }), { db });
    const guardada = await registrar(e.turno.idTurno, entrada, e.usuarioMesa);
    expect(guardada.clase_dictada_id).toBe(nueva.id);
    expect(await db.observacionClase.count({ where: { claseDictadaId: e.clase.id } })).toBe(1);
    expect(await db.observacionClase.count({ where: { claseDictadaId: nueva.id } })).toBe(1);
    await expect(leerObservacionDeClase(e.clase.id, e.usuarioMesa, db)).resolves.toBeNull();
  });
});
