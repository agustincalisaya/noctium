import { afterEach, describe, expect, it, vi } from "vitest";
import { bloquear, ErrorDeBloqueo } from "@/server/shared/bloquear";
import type { Tx } from "@/server/shared/transaccion";

/** tx falso que registra cada SELECT … FOR UPDATE y devuelve los ids pedidos como encontrados. */
function txFalso() {
  const consultas: { tabla: string; ids: string[] }[] = [];
  const $queryRawUnsafe = vi.fn(async (sql: string, ids?: string[]) => {
    const tabla = sql.match(/FROM "([^"]+)"/)![1]!;
    const encontrados = ids ?? ["formapago-a", "formapago-b"];
    consultas.push({ tabla, ids: encontrados });
    return encontrados.map((id) => ({ id }));
  });
  return { tx: { $queryRawUnsafe } as unknown as Tx, consultas, $queryRawUnsafe };
}

describe("bloquear() — orden canónico (PR-0.md §2.10 y §2.16)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("toma recurso → clase → inscripción → operación → caja, y dentro de cada tipo por id ascendente sin repetir", async () => {
    const { tx, consultas } = txFalso();
    const resultado = await bloquear(tx, {
      cajas: ["caja-1"],
      operaciones: ["op-2", "op-1"],
      inscripciones: ["ins-b", "ins-a", "ins-b"],
      clases: ["t-9", "t-1"],
      recursos: {
        fichasGerente: ["fg-2", "fg-1"],
        fichasMesaEntrada: ["fm-1"],
        alumnos: ["al-1"],
        profesores: ["pr-1"],
        materias: ["ma-1"],
        aulas: ["au-1"],
      },
    });
    expect(consultas).toEqual([
      { tabla: "aulas", ids: ["au-1"] },
      { tabla: "materias", ids: ["ma-1"] },
      { tabla: "profesores", ids: ["pr-1"] },
      { tabla: "alumnos", ids: ["al-1"] },
      { tabla: "fichas_mesa_entrada", ids: ["fm-1"] },
      { tabla: "fichas_gerente", ids: ["fg-1", "fg-2"] },
      { tabla: "turnos", ids: ["t-1", "t-9"] },
      { tabla: "turno_alumno", ids: ["ins-a", "ins-b"] },
      { tabla: "operaciones_pago", ids: ["op-1", "op-2"] },
      { tabla: "cajas", ids: ["caja-1"] },
    ]);
    expect(resultado.clases).toEqual(["t-1", "t-9"]);
    expect(resultado.fichasGerente).toEqual(["fg-1", "fg-2"]);
  });

  it("usa FOR UPDATE con ORDER BY por id (COLLATE \"C\") y el id como parámetro", async () => {
    const { tx, $queryRawUnsafe } = txFalso();
    await bloquear(tx, { clases: ["t-1"] });
    expect($queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT "idTurno" AS id FROM "turnos" WHERE "idTurno" = ANY($1::text[]) ORDER BY "idTurno" COLLATE "C" FOR UPDATE',
      ["t-1"],
    );
  });

  it("pedir de nuevo algo ya tomado no hace nada", async () => {
    const { tx, consultas } = txFalso();
    await bloquear(tx, { recursos: { alumnos: ["al-1"] }, clases: ["t-1"] });
    await bloquear(tx, { recursos: { alumnos: ["al-1"] }, clases: ["t-1"] });
    expect(consultas).toHaveLength(2);
  });

  it("se puede seguir hacia adelante en otra llamada (clase después del alumno, id mayor después de uno menor)", async () => {
    const { tx, consultas } = txFalso();
    await bloquear(tx, { recursos: { alumnos: ["al-1"] } });
    await bloquear(tx, { clases: ["t-1"] });
    await bloquear(tx, { clases: ["t-2"] });
    expect(consultas.map((c) => c.tabla)).toEqual(["alumnos", "turnos", "turnos"]);
  });

  it("pedir un nivel anterior al ya tomado lanza ErrorDeBloqueo en desarrollo y pruebas, sin bloquear nada", async () => {
    const { tx, consultas } = txFalso();
    await bloquear(tx, { clases: ["t-1"] });
    await expect(bloquear(tx, { recursos: { alumnos: ["al-1"] } })).rejects.toBeInstanceOf(ErrorDeBloqueo);
    expect(consultas.map((c) => c.tabla)).toEqual(["turnos"]);
  });

  it("pedir un id menor del mismo tipo después de uno mayor también es fuera de orden", async () => {
    const { tx } = txFalso();
    await bloquear(tx, { clases: ["t-5"] });
    await expect(bloquear(tx, { clases: ["t-1"] })).rejects.toThrow(/orden canónico/);
  });

  it("en producción no lanza: registra el error y bloquea igual", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    const { tx, consultas } = txFalso();
    await bloquear(tx, { cajas: ["caja-1"] });
    await bloquear(tx, { clases: ["t-1"] });
    expect(consultas.map((c) => c.tabla)).toEqual(["cajas", "turnos"]);
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();
  });

  it("formas de pago: nivel propio, todas las activas, sin combinarse con otros bloqueos", async () => {
    const { tx, $queryRawUnsafe } = txFalso();
    const resultado = await bloquear(tx, { formasPago: true });
    expect($queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT "idFormaPago" AS id FROM "formas_pago" WHERE "activaFormaPago" ORDER BY "idFormaPago" COLLATE "C" FOR UPDATE',
    );
    expect(resultado.formasPago).toEqual(["formapago-a", "formapago-b"]);
    await expect(bloquear(tx, { clases: ["t-1"] })).rejects.toThrow(/formas de pago/);

    const otro = txFalso();
    await expect(bloquear(otro.tx, { formasPago: true, clases: ["t-1"] })).rejects.toThrow(/no se combina/);
    await bloquear(otro.tx, { clases: ["t-1"] });
    await expect(bloquear(otro.tx, { formasPago: true })).rejects.toBeInstanceOf(ErrorDeBloqueo);
  });

  it("cada transacción lleva su propio registro de bloqueos", async () => {
    const a = txFalso();
    const b = txFalso();
    await bloquear(a.tx, { cajas: ["caja-1"] });
    await expect(bloquear(b.tx, { recursos: { alumnos: ["al-1"] } })).resolves.toEqual({ alumnos: ["al-1"] });
  });

  it("una solicitud vacía no consulta nada", async () => {
    const { tx, $queryRawUnsafe } = txFalso();
    await expect(bloquear(tx, { clases: [], recursos: {} })).resolves.toEqual({});
    expect($queryRawUnsafe).not.toHaveBeenCalled();
  });
});
