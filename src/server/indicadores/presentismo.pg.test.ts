import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearMateriaDePrueba, crearProfesorDePrueba, crearTurnoDePrueba, crearClaseDictadaDePrueba } from "@/server/testing/fabricas";
import { listarAlumnosConPresentismoBajo } from "@/server/historial/historial.publico";

describe.skipIf(!basePgHabilitada)("HU-H-07 umbral y paginación con PostgreSQL real", () => {
  let db: PrismaClient; let materia: string; let profesor: string; let justo: string; let unica: string;
  const rango = { desde: "2002-04", hasta: "2002-04" };
  beforeAll(async () => {
    db = clientePg(); materia = (await crearMateriaDePrueba(db)).idMateria; profesor = (await crearProfesorDePrueba(db)).idProfesor;
    justo = (await crearAlumnoDePrueba(db)).idAlumno; unica = (await crearAlumnoDePrueba(db)).idAlumno;
    const bajos = await Promise.all(Array.from({ length: 11 }, () => crearAlumnoDePrueba(db)));
    for (let d = 1; d <= 4; d++) {
      const t = await crearTurnoDePrueba(db, { materiaId: materia, profesorId: profesor, enDias: 30, hora: `${String(7 + d).padStart(2, "0")}:00` });
      await crearClaseDictadaDePrueba(db, { turnoId: t.idTurno, fecha: new Date(Date.UTC(2002, 3, d)), alumnos: [
        { alumnoId: justo, estado: d === 4 ? "AUSENTE" : "PRESENTE" },
        ...bajos.map(a => ({ alumnoId: a.idAlumno, estado: "AUSENTE" as const })),
        ...(d === 1 ? [{ alumnoId: unica, estado: "AUSENTE" as const }] : []),
      ] });
    }
  });
  afterAll(async () => { await db?.$disconnect(); });
  it("exactamente 75 % queda afuera; mínimo dos clases; once grupos paginan con total correcto", async () => {
    const opciones = { umbral: 75, minimoClases: 2, limite: 10, desplazamiento: 0 };
    const primera = await listarAlumnosConPresentismoBajo(rango, opciones, db);
    expect(primera.total).toBe(11); expect(primera.items).toHaveLength(10); expect(primera.items.some(a => a.alumno_id === justo || a.alumno_id === unica)).toBe(false);
    const segunda = await listarAlumnosConPresentismoBajo(rango, { ...opciones, desplazamiento: 10 }, db);
    expect(segunda.total).toBe(11); expect(segunda.items).toHaveLength(1);
    expect(await listarAlumnosConPresentismoBajo(rango, { ...opciones, desplazamiento: 990 }, db)).toEqual({ total: 11, items: [] });
    const nuevoUmbral = await listarAlumnosConPresentismoBajo(rango, { ...opciones, umbral: 76, limite: 20 }, db);
    expect(nuevoUmbral.total).toBe(12); expect(nuevoUmbral.items.some(a => a.alumno_id === justo)).toBe(true);
  });
});
