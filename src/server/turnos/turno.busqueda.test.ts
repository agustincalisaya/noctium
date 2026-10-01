import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { construirFiltroBusquedaTurno } from "./turno.busqueda";

type Turno = {
  alumnos: { apellido: string; nombre: string }[];
  profesor: { apellido: string; nombre: string } | null;
  materia: string;
  aula: string | null;
};
// Valores ya normalizados, como las columnas *Normalizado* / *Normalizada*.
// Los alumnos están cargados a propósito: la búsqueda no debe encontrarlos.
const turnos: Record<string, Turno> = {
  matematica: { alumnos: [{ apellido: "fernandez", nombre: "sofia" }], profesor: { apellido: "gimenez", nombre: "laura" }, materia: "matematica", aula: "aula 1" },
  datos: { alumnos: [{ apellido: "castro", nombre: "florencia" }], profesor: { apellido: "rossi", nombre: "martin" }, materia: "bases de datos", aula: "aula 2" },
  quimica: { alumnos: [], profesor: { apellido: "castro", nombre: "julian" }, materia: "quimica", aula: "laboratorio" },
  pendiente: { alumnos: [], profesor: null, materia: "quimica", aula: null },
};
type Contiene = Record<string, { contains: string }>;
type Rama = {
  alumnos?: { some: { alumno: { OR: Contiene[] } } };
  profesor?: { is: { OR: Contiene[] } };
  materia?: { is: Contiene };
  aula?: { is: Contiene };
};

const incluye = (valor: string, condicion: Contiene) => Object.values(condicion).every(({ contains }) => valor.includes(contains));
const campo = (persona: { apellido: string; nombre: string }, condicion: Contiene) =>
  Object.entries(condicion).every(([columna, { contains }]) => (columna.startsWith("apellido") ? persona.apellido : persona.nombre).includes(contains));

// Evalúa el `where` que arma construirFiltroBusquedaTurno(): AND de palabras,
// cada una con un OR de ramas por relación (spec_modulo_C.md §2.7). Una
// relación nula (PENDIENTE sin profesor o aula) no coincide, igual que `is`.
// Si el filtro volviera a tener una rama sobre alumnos, también se evaluaría.
function cumple(turno: Turno, where: { AND: { OR: Rama[] }[] }) {
  return where.AND.every(({ OR }) => OR.some((rama) =>
    (rama.alumnos !== undefined && turno.alumnos.some((alumno) => rama.alumnos!.some.alumno.OR.some((c) => campo(alumno, c))))
    || (rama.profesor !== undefined && turno.profesor !== null && rama.profesor.is.OR.some((c) => campo(turno.profesor!, c)))
    || (rama.materia !== undefined && incluye(turno.materia, rama.materia.is))
    || (rama.aula !== undefined && turno.aula !== null && incluye(turno.aula, rama.aula.is))));
}
const buscar = (q: string) => {
  const where = construirFiltroBusquedaTurno(q) as { AND: { OR: Rama[] }[] };
  return Object.keys(turnos).filter((id) => cumple(turnos[id], where));
};

describe("HU-C-02 construirFiltroBusquedaTurno", () => {
  it.each([undefined, "", "   ", "a", " a "])("sin filtro con menos de dos caracteres (%j)", (q) => {
    expect(construirFiltroBusquedaTurno(q)).toBeUndefined();
  });

  it("una palabra busca en profesor, materia y aula normalizados, no en alumnos", () => {
    expect(construirFiltroBusquedaTurno("Química")).toEqual({
      AND: [{ OR: [
        { profesor: { is: { OR: [{ apellidoNormalizadoProfesor: { contains: "quimica" } }, { nombreNormalizadoProfesor: { contains: "quimica" } }] } } },
        { materia: { is: { nombreNormalizadaMateria: { contains: "quimica" } } } },
        { aula: { is: { nombreNormalizadaAula: { contains: "quimica" } } } },
      ] }],
    });
  });

  it("varias palabras: un AND por palabra, como máximo cinco", () => {
    expect((construirFiltroBusquedaTurno("  gimenez   matematica ") as { AND: unknown[] }).AND).toHaveLength(2);
    expect((construirFiltroBusquedaTurno("uno dos tres cuatro cinco seis") as { AND: unknown[] }).AND).toHaveLength(5);
  });

  it.each([
    ["GIMÉNEZ", ["matematica"]], ["julián", ["quimica"]], ["matemática", ["matematica"]], ["aula 2", ["datos"]], ["labo", ["quimica"]],
  ])("encuentra %s por profesor, materia o aula sin depender de acentos o mayúsculas", (q, esperados) => {
    expect(buscar(q)).toEqual(esperados);
  });

  it("un valor que coincide con más de un campo devuelve los turnos de cualquiera (criterio 2)", () => {
    // "ato": materia "bases de datos" y aula "laboratorio".
    expect(buscar("ato")).toEqual(["datos", "quimica"]);
  });

  it("un apellido o nombre que solo tiene un alumno inscripto no genera coincidencias", () => {
    expect(buscar("fernandez")).toEqual([]);
    expect(buscar("sofia")).toEqual([]);
    // "castro" es alumna en "datos" y profesor en "quimica": solo cuenta el profesor.
    expect(buscar("castro")).toEqual(["quimica"]);
  });

  it("varias palabras en cualquier orden, cada una en un campo distinto", () => {
    expect(buscar("gimenez matematica")).toEqual(["matematica"]);
    expect(buscar("matematica gimenez")).toEqual(["matematica"]);
    expect(buscar("rossi aula 2")).toEqual(["datos"]);
    expect(buscar("rossi quimica")).toEqual([]);
  });

  it("un turno PENDIENTE sin profesor ni aula sigue siendo encontrable por la materia", () => {
    expect(buscar("quim")).toEqual(["quimica", "pendiente"]);
    expect(buscar("quimica julian")).toEqual(["quimica"]);
  });

  it("no importa servicios de otros módulos (Regla N.° 3)", () => {
    const fuente = readFileSync(new URL("./turno.busqueda.ts", import.meta.url), "utf8");
    expect(fuente).not.toMatch(/@\/server\//);
  });
});
