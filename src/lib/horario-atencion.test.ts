import { describe, expect, it } from "vitest";
import {
  diaSemanaDeFecha,
  generarHoras,
  horaAMinutos,
  intervaloContenido,
  intervalosSeSuperponen,
  mensajeSuperposicion,
  minutosAHora,
  validarIntervaloHorario,
  type ParametrosHorarioOperativo,
} from "@/lib/horario-atencion";
import { construirRegistrarHorarioSchema } from "@/server/profesores/profesor.schema";

// Código escrito, no ejecutado — sin test runner instalado (HU-D-01 §6).
// La misma lógica se verificó contra una base real con el servicio
// registrarHorarioProfesor() (ver informe de HU-D-04).

const PARAMETROS: ParametrosHorarioOperativo = {
  diasOperativos: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"],
  apertura: "08:00",
  cierre: "20:00",
  granularidadMinutos: 30,
};

const intervalo = (a: string, b: string) => ({ inicio: horaAMinutos(a), fin: horaAMinutos(b) });

describe("horaAMinutos / minutosAHora", () => {
  it("convierte en ambos sentidos", () => {
    expect(horaAMinutos("10:30")).toBe(630);
    expect(minutosAHora(630)).toBe("10:30");
    expect(minutosAHora(480)).toBe("08:00");
  });
});

describe("intervalosSeSuperponen (criterio 4)", () => {
  it("detecta superposición parcial", () => {
    expect(intervalosSeSuperponen(intervalo("10:00", "12:00"), intervalo("11:00", "13:00"))).toBe(true);
  });

  it("detecta un intervalo contenido en otro", () => {
    expect(intervalosSeSuperponen(intervalo("10:00", "14:00"), intervalo("11:00", "12:00"))).toBe(true);
  });

  it("detecta intervalos idénticos", () => {
    expect(intervalosSeSuperponen(intervalo("10:00", "12:00"), intervalo("10:00", "12:00"))).toBe(true);
  });

  it("NO considera superpuestos a los contiguos (10:00–12:00 y 12:00–14:00)", () => {
    expect(intervalosSeSuperponen(intervalo("10:00", "12:00"), intervalo("12:00", "14:00"))).toBe(false);
    expect(intervalosSeSuperponen(intervalo("12:00", "14:00"), intervalo("10:00", "12:00"))).toBe(false);
  });

  it("NO considera superpuestos a intervalos separados", () => {
    expect(intervalosSeSuperponen(intervalo("08:00", "09:00"), intervalo("10:00", "11:00"))).toBe(false);
  });
});

describe("intervaloContenido (contrato HU-C-04)", () => {
  it("acepta un intervalo dentro, bordes incluidos", () => {
    expect(intervaloContenido(intervalo("10:00", "12:00"), intervalo("10:00", "12:00"))).toBe(true);
    expect(intervaloContenido(intervalo("10:30", "11:30"), intervalo("10:00", "12:00"))).toBe(true);
  });

  it("rechaza un intervalo que se sale por algún extremo", () => {
    expect(intervaloContenido(intervalo("11:00", "13:00"), intervalo("10:00", "12:00"))).toBe(false);
    expect(intervaloContenido(intervalo("09:30", "11:00"), intervalo("10:00", "12:00"))).toBe(false);
  });
});

describe("validarIntervaloHorario", () => {
  const validar = (diaSemana: "LUNES" | "SABADO", horaInicio: string, horaFin: string) =>
    validarIntervaloHorario({ diaSemana, horaInicio, horaFin }, PARAMETROS);

  it("acepta un intervalo válido", () => {
    expect(validar("LUNES", "10:00", "12:30")).toBeNull();
    expect(validar("LUNES", "08:00", "20:00")).toBeNull();
  });

  it("rechaza un día en que el centro no atiende", () => {
    expect(validar("SABADO", "10:00", "12:00")?.codigo).toBe("DIA_NO_OPERATIVO");
  });

  it("rechaza horas fuera de la granularidad (bloques de 30 min)", () => {
    const inicio = validar("LUNES", "10:15", "12:00");
    expect(inicio?.codigo).toBe("HORA_NO_GRANULAR");
    expect(inicio?.campo).toBe("horaInicio");
    expect(validar("LUNES", "10:00", "11:45")?.campo).toBe("horaFin");
  });

  it("rechaza inicio igual o posterior al fin", () => {
    expect(validar("LUNES", "12:00", "12:00")?.codigo).toBe("HORARIO_INVERTIDO");
    expect(validar("LUNES", "14:00", "12:00")?.codigo).toBe("HORARIO_INVERTIDO");
  });

  it("rechaza un intervalo que empieza antes de la apertura, indicando la franja", () => {
    const error = validar("LUNES", "07:30", "09:00");
    expect(error?.codigo).toBe("FUERA_DE_HORARIO_OPERATIVO");
    expect(error?.campo).toBe("horaInicio");
    expect(error?.mensaje).toContain("08:00 a 20:00");
  });

  it("rechaza un intervalo que termina después del cierre, indicando la franja", () => {
    const error = validar("LUNES", "19:00", "21:00");
    expect(error?.codigo).toBe("FUERA_DE_HORARIO_OPERATIVO");
    expect(error?.campo).toBe("horaFin");
    expect(error?.mensaje).toContain("08:00 a 20:00");
  });
});

describe("construirRegistrarHorarioSchema", () => {
  const schema = construirRegistrarHorarioSchema(PARAMETROS);
  const PROFESOR = "ckprofesor00000000000001";

  it("acepta datos válidos", () => {
    const datos = { profesorId: PROFESOR, diaSemana: "LUNES", horaInicio: "10:00", horaFin: "12:00" };
    expect(schema.parse(datos)).toEqual(datos);
  });

  it("exige profesor, día y horas", () => {
    const resultado = schema.safeParse({ profesorId: "", diaSemana: "", horaInicio: "", horaFin: "" });
    expect(resultado.success).toBe(false);
    const campos = new Set(resultado.error?.issues.map((issue) => issue.path[0]));
    expect(campos).toEqual(new Set(["profesorId", "diaSemana", "horaInicio", "horaFin"]));
  });

  it("rechaza horas que no están en formato 24 h", () => {
    const resultado = schema.safeParse({ profesorId: PROFESOR, diaSemana: "LUNES", horaInicio: "9:00", horaFin: "25:00" });
    expect(resultado.success).toBe(false);
  });

  it("marca el error de franja en el campo correspondiente", () => {
    const resultado = schema.safeParse({ profesorId: PROFESOR, diaSemana: "LUNES", horaInicio: "19:00", horaFin: "21:00" });
    expect(resultado.error?.issues[0]?.path).toEqual(["horaFin"]);
  });
});

describe("helpers de UI", () => {
  it("genera las opciones de hora en pasos de la granularidad", () => {
    expect(generarHoras("08:00", "09:30", 30)).toEqual(["08:00", "08:30", "09:00", "09:30"]);
  });

  it("toma el día de la semana de una fecha @db.Date (UTC)", () => {
    expect(diaSemanaDeFecha(new Date(Date.UTC(2026, 8, 21)))).toBe("LUNES");
    expect(diaSemanaDeFecha(new Date(Date.UTC(2026, 8, 27)))).toBe("DOMINGO");
  });

  it("arma el mensaje exacto del criterio 5", () => {
    expect(mensajeSuperposicion("LUNES", "10:00", "12:00")).toBe(
      "El intervalo se superpone con Lunes 10:00–12:00",
    );
  });
});
