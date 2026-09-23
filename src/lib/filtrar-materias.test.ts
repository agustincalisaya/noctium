import { describe, expect, it } from "vitest";
import { filtrarMaterias } from "@/lib/filtrar-materias";

// Código escrito, no ejecutado — sin test runner instalado (HU-D-01 §6).

const MATEMATICA = { id: "1", nombre: "Matemática", codigo: "MAT101" };
const FISICA = { id: "2", nombre: "Física", codigo: "FIS101" };
const QUIMICA = { id: "3", nombre: "Química", codigo: null };
const MATERIAS = [MATEMATICA, FISICA, QUIMICA];

describe("filtrarMaterias", () => {
  it("encuentra por nombre sin acentos ni mayúsculas", () => {
    expect(filtrarMaterias(MATERIAS, "matematica")).toEqual([MATEMATICA]);
  });

  it("encuentra por código sin mayúsculas", () => {
    expect(filtrarMaterias(MATERIAS, "mat101")).toEqual([MATEMATICA]);
  });

  it("un filtro vacío devuelve todo", () => {
    expect(filtrarMaterias(MATERIAS, "")).toEqual(MATERIAS);
    expect(filtrarMaterias(MATERIAS, "   ")).toEqual(MATERIAS);
  });

  it("ignora el código ausente sin fallar", () => {
    expect(filtrarMaterias(MATERIAS, "quimica")).toEqual([QUIMICA]);
    expect(filtrarMaterias(MATERIAS, "101")).toEqual([MATEMATICA, FISICA]);
  });

  it("sin coincidencias devuelve lista vacía", () => {
    expect(filtrarMaterias(MATERIAS, "historia")).toEqual([]);
  });
});
