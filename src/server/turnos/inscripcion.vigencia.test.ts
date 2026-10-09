import { describe, expect, it, vi } from "vitest";
import type { EstadoTurno } from "@prisma/client";
import {
  calcularVencimiento,
  esVigenteEn,
  estadoSegunOcupacion,
  recalcularEstadoTurno,
  sqlVigenteEn,
  type InscripcionParaVigencia,
} from "@/server/turnos/inscripcion.vigencia";
import type { Tx } from "@/server/shared/transaccion";

const venceEl = new Date("2030-05-10T12:00:00.000Z");
const antes = new Date(venceEl.getTime() - 1);
const despues = new Date(venceEl.getTime() + 1);
const reserva = (cambios: Partial<InscripcionParaVigencia> = {}): InscripcionParaVigencia => ({
  vigencia: "VIGENTE", estadoPago: "RESERVADA", venceEl, estadoClase: "DISPONIBLE", ...cambios,
});

describe("esVigenteEn (PR-0.md §2.2)", () => {
  it("una reserva es vigente antes de venceEl y vence en venceEl y después", () => {
    expect(esVigenteEn(reserva(), antes)).toBe(true);
    expect(esVigenteEn(reserva(), venceEl)).toBe(false);
    expect(esVigenteEn(reserva(), despues)).toBe(false);
  });

  it("vale igual en una clase COMPLETO", () => {
    expect(esVigenteEn(reserva({ estadoClase: "COMPLETO" }), despues)).toBe(false);
  });

  it("en una clase CANCELADO las reservas dejan de vencer (HU-C-24, criterio 6)", () => {
    expect(esVigenteEn(reserva({ estadoClase: "CANCELADO" }), despues)).toBe(true);
  });

  it("PAGADA y PAGO_SIN_REGISTRAR no vencen", () => {
    expect(esVigenteEn(reserva({ estadoPago: "PAGADA", venceEl: null }), despues)).toBe(true);
    expect(esVigenteEn(reserva({ estadoPago: "PAGO_SIN_REGISTRAR", venceEl: null }), despues)).toBe(true);
  });

  it.each(["CANCELADA_ALUMNO", "RESERVA_VENCIDA", "BAJA_ALUMNO", "QUITADA_CENTRO"] as const)(
    "una inscripción %s nunca es vigente", (vigencia) => {
      expect(esVigenteEn(reserva({ vigencia }), antes)).toBe(false);
      expect(esVigenteEn(reserva({ vigencia, estadoPago: "PAGADA", venceEl: null }), antes)).toBe(false);
    },
  );
});

describe("estado Disponible/Completa (PR-0.md §2.2)", () => {
  it("DISPONIBLE ⇄ COMPLETO según las vigentes y el cupo", () => {
    expect(estadoSegunOcupacion("DISPONIBLE", 3, 3)).toBe("COMPLETO");
    expect(estadoSegunOcupacion("COMPLETO", 2, 3)).toBe("DISPONIBLE");
    expect(estadoSegunOcupacion("DISPONIBLE", 2, 3)).toBe("DISPONIBLE");
  });

  it.each(["PENDIENTE", "CANCELADO"] as const)("no cambia una clase %s", (estado) => {
    expect(estadoSegunOcupacion(estado, 99, 1)).toBe(estado);
  });

  function txFalso(estadoTurno: EstadoTurno, cupo: number | null, inscripciones: InscripcionParaVigencia[], count = 1) {
    const updateMany = vi.fn(async () => ({ count }));
    const tx = {
      turno: {
        findUnique: vi.fn(async () => ({ estadoTurno, cupoMaximoTurno: cupo })),
        updateMany,
      },
      turnoAlumno: {
        findMany: vi.fn(async () => inscripciones.filter((i) => i.vigencia === "VIGENTE")
          .map((i, n) => ({ idInscripcion: `i${n}`, alumnoId: `a${n}`, ...i }))),
      },
    };
    return { tx: tx as unknown as Tx, updateMany };
  }

  it("recalcularEstadoTurno guarda COMPLETO cuando las vigentes llenan el cupo, con condición sobre el estado anterior", async () => {
    const { tx, updateMany } = txFalso("DISPONIBLE", 2, [reserva(), reserva({ estadoPago: "PAGADA", venceEl: null })]);
    await expect(recalcularEstadoTurno(tx, "t1", antes)).resolves.toEqual({ anterior: "DISPONIBLE", nuevo: "COMPLETO", cambio: true });
    expect(updateMany).toHaveBeenCalledWith({ where: { idTurno: "t1", estadoTurno: "DISPONIBLE" }, data: { estadoTurno: "COMPLETO" } });
  });

  it("una clase COMPLETO llena solo por una reserva vencida sin marcar vuelve a DISPONIBLE", async () => {
    const { tx } = txFalso("COMPLETO", 2, [reserva(), reserva({ estadoPago: "PAGADA", venceEl: null })]);
    await expect(recalcularEstadoTurno(tx, "t1", despues)).resolves.toEqual({ anterior: "COMPLETO", nuevo: "DISPONIBLE", cambio: true });
  });

  it("no toca la base si el estado no cambia, ni una clase PENDIENTE o CANCELADO", async () => {
    for (const estado of ["DISPONIBLE", "PENDIENTE", "CANCELADO"] as const) {
      const { tx, updateMany } = txFalso(estado, 5, [reserva()]);
      await expect(recalcularEstadoTurno(tx, "t1", antes)).resolves.toEqual({ anterior: estado, nuevo: estado, cambio: false });
      expect(updateMany).not.toHaveBeenCalled();
    }
  });

  it("si otro cambió el estado entre la lectura y la escritura, informa que no hubo cambio", async () => {
    const { tx } = txFalso("DISPONIBLE", 1, [reserva()], 0);
    await expect(recalcularEstadoTurno(tx, "t1", antes)).resolves.toEqual({ anterior: "DISPONIBLE", nuevo: "DISPONIBLE", cambio: false });
  });
});

describe("calcularVencimiento (PR-0.md §2.2)", () => {
  const momento = new Date("2030-05-10T12:00:00.000Z");

  it("venceBaseEl = momento + plazo; venceEl = el menor entre venceBaseEl y el inicio de la clase", () => {
    const lejos = new Date("2030-05-20T12:00:00.000Z");
    expect(calcularVencimiento(momento, lejos, 24)).toEqual({
      venceBaseEl: new Date("2030-05-11T12:00:00.000Z"), venceEl: new Date("2030-05-11T12:00:00.000Z"),
    });
    const cerca = new Date("2030-05-10T20:00:00.000Z");
    expect(calcularVencimiento(momento, cerca, 24)).toEqual({ venceBaseEl: new Date("2030-05-11T12:00:00.000Z"), venceEl: cerca });
  });
});

describe("sqlVigenteEn", () => {
  it("rechaza un alias que no es un identificador simple", () => {
    expect(() => sqlVigenteEn('ta"; DROP TABLE x; --', new Date())).toThrow(/alias inválido/);
  });

  it("pasa el momento como parámetro, sin now()", () => {
    const fragmento = sqlVigenteEn("ta", venceEl);
    expect(fragmento.sql).not.toMatch(/now\(\)/i);
    expect(fragmento.values).toContain(venceEl.toISOString());
  });
});
