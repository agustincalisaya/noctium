import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearInscripcionDePrueba, crearMateriaDePrueba, crearProfesorDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { registrarClaseDictada } from "@/server/historial/clase-dictada.service";
import { opcionesDeIndicacion, registrarIndicacion } from "@/server/historial/indicacion.service";
import { actorUsuario } from "@/server/shared/historial";
import { ahora } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";

describe.skipIf(!basePgHabilitada)("HU-E-04 indicaciones con PostgreSQL real", () => {
  let db: PrismaClient;
  beforeAll(() => { db = clientePg(); });
  afterAll(async () => { await db?.$disconnect(); });

  async function escenario({ activo = true }: { activo?: boolean } = {}) {
    const [mesa, profesorUsuario, otroProfesorUsuario, alumno, materia] = await Promise.all([
      crearUsuarioDePrueba(db, { rol: "MESA_ENTRADA" }),
      crearUsuarioDePrueba(db, { rol: "PROFESOR" }),
      crearUsuarioDePrueba(db, { rol: "PROFESOR" }),
      crearAlumnoDePrueba(db, { activo }),
      crearMateriaDePrueba(db),
    ]);
    const [profesor, otroProfesor] = await Promise.all([crearProfesorDePrueba(db), crearProfesorDePrueba(db)]);
    await Promise.all([
      db.profesor.update({ where: { idProfesor: profesor.idProfesor }, data: { usuarioId: profesorUsuario.idUsuario } }),
      db.profesor.update({ where: { idProfesor: otroProfesor.idProfesor }, data: { usuarioId: otroProfesorUsuario.idUsuario } }),
    ]);
    const turno = await crearTurnoDePrueba(db, { enDias: -2, materiaId: materia.idMateria, profesorId: profesor.idProfesor });
    await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno });
    const clase = await transaccion((tx) => registrarClaseDictada(tx, {
      turnoId: turno.idTurno, actor: actorUsuario(mesa.idUsuario),
    }), { db });
    return {
      mesa, profesorUsuario, otroProfesorUsuario, alumno, materia, profesor, otroProfesor, turno, clase,
      usuarioMesa: { id: mesa.idUsuario, rol: "MESA_ENTRADA" as const },
      usuarioProfesor: { id: profesorUsuario.idUsuario, rol: "PROFESOR" as const },
      usuarioOtroProfesor: { id: otroProfesorUsuario.idUsuario, rol: "PROFESOR" as const },
    };
  }

  const registrar = (alumnoId: string, datos: { materia_id: string; indicacion: string; clase_dictada_id?: string }, usuario: { id: string; rol: "MESA_ENTRADA" | "PROFESOR" }) =>
    transaccion((tx) => registrarIndicacion(tx, alumnoId, datos, usuario), { db });

  it("persiste texto, autor, fecha y relación opcional y permite varias indicaciones", async () => {
    const e = await escenario();
    const primera = await registrar(e.alumno.idAlumno, { materia_id: e.materia.idMateria, indicacion: "Repasar ecuaciones", clase_dictada_id: e.clase.id }, e.usuarioMesa);
    const segunda = await registrar(e.alumno.idAlumno, { materia_id: e.materia.idMateria, indicacion: "Practicar ejercicios" }, e.usuarioMesa);
    expect(primera).toMatchObject({ alumno_id: e.alumno.idAlumno, materia_id: e.materia.idMateria, clase_dictada_id: e.clase.id, registrada_por: e.mesa.emailUsuario });
    expect(segunda).toMatchObject({ alumno_id: e.alumno.idAlumno, materia_id: e.materia.idMateria, clase_dictada_id: null });
    expect(primera.id).not.toBe(segunda.id);
    const fila = await db.indicacion.findUniqueOrThrow({ where: { idIndicacion: primera.id } });
    expect(fila).toMatchObject({ alumnoId: e.alumno.idAlumno, materiaId: e.materia.idMateria, claseDictadaId: e.clase.id, texto: "Repasar ecuaciones", creadoPorUsuarioId: e.mesa.idUsuario });
    expect(fila.createdAtIndicacion.toISOString()).toBe(primera.registrada_en);
  });

  it("permite al profesor con clase propia y rechaza al profesor ajeno", async () => {
    const e = await escenario();
    await expect(registrar(e.alumno.idAlumno, { materia_id: e.materia.idMateria, indicacion: "Repasar" }, e.usuarioProfesor)).resolves.toMatchObject({ registrada_por: e.profesorUsuario.emailUsuario });
    await expect(registrar(e.alumno.idAlumno, { materia_id: e.materia.idMateria, indicacion: "Repasar otra vez" }, e.usuarioOtroProfesor)).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });

  it("rechaza materia no cursada y alumno inactivo", async () => {
    const e = await escenario();
    const otra = await crearMateriaDePrueba(db);
    await expect(registrar(e.alumno.idAlumno, { materia_id: otra.idMateria, indicacion: "Repasar" }, e.usuarioMesa)).rejects.toMatchObject({ code: "MATERIA_NO_CURSADA" });
    const inactivo = await escenario({ activo: false });
    await expect(registrar(inactivo.alumno.idAlumno, { materia_id: inactivo.materia.idMateria, indicacion: "Repasar" }, inactivo.usuarioMesa)).rejects.toMatchObject({ code: "ALUMNO_INACTIVO" });
  });

  it("valida que la clase vinculada exista, siga vigente y corresponda al alumno y la materia", async () => {
    const e = await escenario();
    await expect(registrar(e.alumno.idAlumno, { materia_id: e.materia.idMateria, indicacion: "Repasar", clase_dictada_id: "no-existe" }, e.usuarioMesa)).rejects.toMatchObject({ code: "CLASE_DICTADA_NO_ENCONTRADA" });
    const otraMateria = await crearMateriaDePrueba(db);
    const otroTurno = await crearTurnoDePrueba(db, { enDias: -1, materiaId: otraMateria.idMateria, profesorId: e.otroProfesor.idProfesor });
    await crearInscripcionDePrueba(db, { turnoId: otroTurno.idTurno, alumnoId: e.alumno.idAlumno });
    const otraClase = await transaccion((tx) => registrarClaseDictada(tx, { turnoId: otroTurno.idTurno, actor: actorUsuario(e.mesa.idUsuario) }), { db });
    await expect(registrar(e.alumno.idAlumno, { materia_id: e.materia.idMateria, indicacion: "Repasar", clase_dictada_id: otraClase.id }, e.usuarioMesa)).rejects.toMatchObject({ code: "CLASE_DICTADA_NO_CORRESPONDE" });

    const cursadaVigenteTurno = await crearTurnoDePrueba(db, { enDias: -1, hora: "12:00", materiaId: e.materia.idMateria, profesorId: e.otroProfesor.idProfesor });
    await crearInscripcionDePrueba(db, { turnoId: cursadaVigenteTurno.idTurno, alumnoId: e.alumno.idAlumno });
    await transaccion((tx) => registrarClaseDictada(tx, { turnoId: cursadaVigenteTurno.idTurno, actor: actorUsuario(e.mesa.idUsuario) }), { db });

    await db.claseDictada.update({ where: { idClaseDictada: e.clase.id }, data: { anuladaEl: ahora(), anuladaPorUsuarioId: e.mesa.idUsuario, motivoAnulacion: "Prueba HU-E-11" } });
    await expect(registrar(e.alumno.idAlumno, { materia_id: e.materia.idMateria, indicacion: "Repasar", clase_dictada_id: e.clase.id }, e.usuarioMesa)).rejects.toMatchObject({ code: "CLASE_DICTADA_NO_ENCONTRADA" });
  });

  it("expone solo clases vigentes como opciones para vincular", async () => {
    const e = await escenario();
    expect(await opcionesDeIndicacion(e.alumno.idAlumno, e.materia.idMateria, db)).toEqual({
      materias: [{ id: e.materia.idMateria, nombre: e.materia.nombreMateria }],
      clases: [{ id: e.clase.id, materia_id: e.materia.idMateria, fecha: e.turno.fechaTurno.toISOString().slice(0, 10) }],
    });
    await db.claseDictada.update({ where: { idClaseDictada: e.clase.id }, data: { anuladaEl: ahora(), anuladaPorUsuarioId: e.mesa.idUsuario, motivoAnulacion: "Prueba HU-E-11" } });
    await expect(opcionesDeIndicacion(e.alumno.idAlumno, e.materia.idMateria, db)).resolves.toEqual({ materias: [], clases: [] });
  });
});
