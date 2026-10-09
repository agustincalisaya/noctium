import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearClaseDictadaDePrueba, crearMateriaDePrueba, crearProfesorDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { corregirResultadoExamen, anularResultadoExamen } from "@/server/historial/resultado-examen.service";
import { obtenerHistorialAlumno } from "@/server/historial/historial.service";
import { conReloj } from "@/server/shared/reloj";

describe.skipIf(!basePgHabilitada)("HU-E-10 corrección y anulación con PostgreSQL real", () => {
  let db: PrismaClient;
  let alumnoId: string;
  let materiaId: string;
  let profesorId: string;
  let profesorUsuarioId: string;
  let mesaUsuarioId: string;
  let gerenteUsuarioId: string;

  beforeAll(async () => {
    db = clientePg();
    const [alumno, materia, profesorUsuario, mesa, gerente] = await Promise.all([
      crearAlumnoDePrueba(db), crearMateriaDePrueba(db), crearUsuarioDePrueba(db, { rol: "PROFESOR" }),
      crearUsuarioDePrueba(db, { rol: "MESA_ENTRADA" }), crearUsuarioDePrueba(db, { rol: "GERENTE" }),
    ]);
    const profesor = await crearProfesorDePrueba(db);
    await db.profesor.update({ where: { idProfesor: profesor.idProfesor }, data: { usuarioId: profesorUsuario.idUsuario } });
    alumnoId = alumno.idAlumno;
    materiaId = materia.idMateria;
    profesorId = profesor.idProfesor;
    profesorUsuarioId = profesorUsuario.idUsuario;
    mesaUsuarioId = mesa.idUsuario;
    gerenteUsuarioId = gerente.idUsuario;
  });

  afterAll(async () => { await db?.$disconnect(); });

  async function crearResultado(creadoPorUsuarioId: string, createdAtResultadoExamen: Date) {
    return db.resultadoExamen.create({
      data: {
        alumnoId, materiaId, fechaExamen: new Date("2026-09-15T00:00:00.000Z"), notaExamen: "8.0",
        creadoPorUsuarioId, createdAtResultadoExamen,
      },
    });
  }

  it("agrega correcciones consecutivas, lee la última y conserva intacto el original", async () => {
    const original = await crearResultado(profesorUsuarioId, new Date("2026-10-02T13:00:00.000Z"));
    await conReloj(new Date("2026-10-08T14:00:00.000Z"), () => corregirResultadoExamen(
      alumnoId, original.idResultadoExamen, { nota: "9", motivo: "Revisión del parcial" }, { id: profesorUsuarioId, rol: "PROFESOR" },
    ));
    await conReloj(new Date("2026-10-09T14:00:00.000Z"), () => corregirResultadoExamen(
      alumnoId, original.idResultadoExamen,
      { fecha_examen: new Date("2026-09-16T00:00:00.000Z"), nota: "9.5", motivo: "Fecha y nota corregidas" },
      { id: profesorUsuarioId, rol: "PROFESOR" },
    ));

    const persistido = await db.resultadoExamen.findUniqueOrThrow({ where: { idResultadoExamen: original.idResultadoExamen } });
    expect(persistido.fechaExamen).toEqual(new Date("2026-09-15T00:00:00.000Z"));
    expect(persistido.notaExamen.toFixed(1)).toBe("8.0");
    const correcciones = await db.correccionResultadoExamen.findMany({ where: { resultadoExamenId: original.idResultadoExamen }, orderBy: { createdAtCorreccion: "asc" } });
    expect(correcciones).toHaveLength(2);
    expect(correcciones[1]).toMatchObject({
      fechaAnterior: new Date("2026-09-15T00:00:00.000Z"),
      fechaNueva: new Date("2026-09-16T00:00:00.000Z"), motivo: "Fecha y nota corregidas", creadoPorUsuarioId: profesorUsuarioId,
    });
    expect(correcciones[1]!.notaAnterior.toFixed(1)).toBe("9.0");
    expect(correcciones[1]!.notaNueva.toFixed(1)).toBe("9.5");

    const historial = await obtenerHistorialAlumno(alumnoId, { pagina: 1, por_pagina: 10 }, { id: mesaUsuarioId, rol: "MESA_ENTRADA" });
    expect(historial.items.find((item) => item.tipo === "EXAMEN" && item.id === original.idResultadoExamen)).toMatchObject({
      fecha: "2026-09-16", nota: "9.5", corregido: true, anulado: false, puede_corregir: true,
    });
  });

  it("permite al Profesor hasta el séptimo día calendario de Buenos Aires y rechaza desde el octavo", async () => {
    const dentro = await crearResultado(profesorUsuarioId, new Date("2026-10-01T13:00:00.000Z"));
    await expect(conReloj(new Date("2026-10-09T02:59:59.000Z"), () => corregirResultadoExamen(
      alumnoId, dentro.idResultadoExamen, { nota: "9", motivo: "Dentro del séptimo día" }, { id: profesorUsuarioId, rol: "PROFESOR" },
    ))).resolves.toMatchObject({ nota: "9.0" });

    const vencido = await crearResultado(profesorUsuarioId, new Date("2026-10-01T13:00:00.000Z"));
    await expect(conReloj(new Date("2026-10-09T03:00:00.000Z"), () => corregirResultadoExamen(
      alumnoId, vencido.idResultadoExamen, { nota: "9", motivo: "Día ocho" }, { id: profesorUsuarioId, rol: "PROFESOR" },
    ))).rejects.toMatchObject({ code: "PLAZO_CORRECCION_VENCIDO" });

    const ajeno = await crearResultado(mesaUsuarioId, new Date("2026-10-01T13:00:00.000Z"));
    await expect(conReloj(new Date("2026-10-05T14:00:00.000Z"), () => corregirResultadoExamen(
      alumnoId, ajeno.idResultadoExamen, { nota: "9", motivo: "No es propio" }, { id: profesorUsuarioId, rol: "PROFESOR" },
    ))).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });

  it("conserva el anulado y lo muestra solo a Mesa y Gerencia en el historial", async () => {
    const turno = await crearTurnoDePrueba(db, { enDias: -2, materiaId, profesorId });
    await crearClaseDictadaDePrueba(db, { turnoId: turno.idTurno, alumnos: [{ alumnoId, estado: null }], conControl: false });
    const original = await crearResultado(profesorUsuarioId, new Date("2026-10-02T13:00:00.000Z"));
    const momento = new Date("2026-10-04T14:00:00.000Z");
    await expect(conReloj(momento, () => anularResultadoExamen(
      alumnoId, original.idResultadoExamen, { motivo: "Resultado cargado a otra persona" }, { id: profesorUsuarioId, rol: "PROFESOR" },
    ))).resolves.toMatchObject({ motivo: "Resultado cargado a otra persona", registrada_por: expect.any(String) });

    const originalPersistido = await db.resultadoExamen.findUniqueOrThrow({ where: { idResultadoExamen: original.idResultadoExamen } });
    expect(originalPersistido.notaExamen.toFixed(1)).toBe("8.0");
    expect(await db.anulacionResultadoExamen.count({ where: { resultadoExamenId: original.idResultadoExamen } })).toBe(1);

    const mesa = await obtenerHistorialAlumno(alumnoId, { pagina: 1, por_pagina: 10 }, { id: mesaUsuarioId, rol: "MESA_ENTRADA" });
    const gerente = await obtenerHistorialAlumno(alumnoId, { pagina: 1, por_pagina: 10 }, { id: gerenteUsuarioId, rol: "GERENTE" });
    const profesor = await obtenerHistorialAlumno(alumnoId, { pagina: 1, por_pagina: 10 }, { id: profesorUsuarioId, rol: "PROFESOR" });
    const visibleMesa = mesa.items.find((item) => item.tipo === "EXAMEN" && item.id === original.idResultadoExamen);
    const visibleGerente = gerente.items.find((item) => item.tipo === "EXAMEN" && item.id === original.idResultadoExamen);
    expect(visibleMesa).toMatchObject({ anulado: true, puede_corregir: false, anulacion: { motivo: "Resultado cargado a otra persona" } });
    expect(visibleGerente).toMatchObject({ anulado: true, puede_corregir: false, anulacion: { motivo: "Resultado cargado a otra persona" } });
    expect(profesor.items.some((item) => item.tipo === "EXAMEN" && item.id === original.idResultadoExamen)).toBe(false);
  });

  it("serializa dos anulaciones y deja una sola fila de auditoría", async () => {
    const original = await crearResultado(mesaUsuarioId, new Date("2026-10-02T13:00:00.000Z"));
    const momento = new Date("2026-10-04T14:00:00.000Z");
    const resultados = await conReloj(momento, () => Promise.allSettled([
      anularResultadoExamen(alumnoId, original.idResultadoExamen, { motivo: "Anulación concurrente A" }, { id: mesaUsuarioId, rol: "MESA_ENTRADA" }),
      anularResultadoExamen(alumnoId, original.idResultadoExamen, { motivo: "Anulación concurrente B" }, { id: mesaUsuarioId, rol: "MESA_ENTRADA" }),
    ]));
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((resultado) => resultado.status === "rejected")).toHaveLength(1);
    expect(await db.anulacionResultadoExamen.count({ where: { resultadoExamenId: original.idResultadoExamen } })).toBe(1);
  });
});
