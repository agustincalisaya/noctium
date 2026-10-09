import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TEXTOS, texto } from "@/lib/textos";
import { CODIGOS_SPRINTS_1_Y_2, ERRORES_DE_DOMINIO } from "@/server/shared/errores-dominio";
import { ErrorDeDominio, esErrorDeDominio, statusDeErrorNuevo } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";

const SRC = fileURLToPath(new URL("../..", import.meta.url));

function archivosTs(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return archivosTs(ruta);
    return /\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

describe("prueba de claves (HU-C-23, PR-0.md §2.13)", () => {
  it("todo código del catálogo de errores tiene su texto en el archivo central", () => {
    const sinTexto = Object.keys(ERRORES_DE_DOMINIO).filter(
      (clave) => typeof (TEXTOS as Record<string, string>)[clave] !== "string" || !(TEXTOS as Record<string, string>)[clave].trim(),
    );
    expect(sinTexto).toEqual([]);
  });

  it("todo ErrorDeDominio(\"…\") del código usa una clave del catálogo", () => {
    const usadas = archivosTs(SRC).flatMap((ruta) =>
      [...readFileSync(ruta, "utf8").matchAll(/new ErrorDeDominio\(\s*["']([^"']+)["']/g)].map(([, clave]) => clave!),
    );
    const desconocidas = usadas.filter((clave) => !(clave in ERRORES_DE_DOMINIO));
    expect(desconocidas).toEqual([]);
  });

  it("los textos no tienen espacios sobrantes ni huecos mal escritos", () => {
    for (const [clave, valor] of Object.entries(TEXTOS)) {
      expect(valor, clave).toBe(valor.trim());
      expect(valor.replace(/\{\w+\}/g, ""), clave).not.toMatch(/[{}]/);
    }
  });

  it("las claves siguen el formato «área.subárea.nombre»", () => {
    for (const clave of Object.keys(TEXTOS)) expect(clave).toMatch(/^[a-z]+(\.[a-zA-Z]+){2,}$/);
  });

  it("los errores que ya existían en Sprint 2 conservan el texto de POST /api/pagos (1.1)", () => {
    const ruta = readFileSync(join(SRC, "app/api/pagos/route.ts"), "utf8");
    for (const clave of [
      "errores.pago.turnoNoAdmitePago", "errores.pago.alumnoNoInscripto", "errores.formaPago.noEncontrada",
      "errores.formaPago.noDisponible", "errores.pago.fechaFutura",
    ] as const) {
      const { code } = ERRORES_DE_DOMINIO[clave];
      expect(ruta, clave).toContain(`${code}: { status: ${ERRORES_DE_DOMINIO[clave].status}, message: "${TEXTOS[clave]}" }`);
    }
  });

  it("los errores de inscripción que ya existían conservan code y texto de Sprint 2 (1.1)", () => {
    // Literales de turno.service.ts de Sprint 2: desde la etapa 3 la inscripción
    // los lanza con estas claves (crearInscripcion), así que se fijan acá.
    const sprint2 = {
      "errores.turno.cupoInsuficiente": ["CUPO_INSUFICIENTE", "El turno alcanzó su cupo máximo"],
      "errores.alumno.inactivo": ["ALUMNO_INACTIVO", "La ficha del alumno está inactiva"],
      "errores.alumno.inactivoPropio": ["ALUMNO_INACTIVO", "Tu ficha de alumno no está activa"],
      "errores.inscripcion.alumnoYaAsignado": ["ALUMNO_YA_ASIGNADO", "El mismo alumno no puede agregarse dos veces al mismo turno"],
      "errores.inscripcion.alumnoYaAsignadoPropio": ["ALUMNO_YA_ASIGNADO", "Ya estás inscripto en este turno"],
      "errores.inscripcion.alumnoNoDisponible": ["ALUMNO_NO_DISPONIBLE", "El alumno ya tiene un turno agendado en ese horario"],
      "errores.inscripcion.alumnoNoDisponiblePropio": ["ALUMNO_NO_DISPONIBLE", "Ya tenés otro turno en ese horario"],
      "errores.inscripcion.alumnoNoDisponibleOInactivo": ["ALUMNO_NO_DISPONIBLE", "El alumno no existe o no está activo"],
      "errores.turno.noEncontrado": ["TURNO_NO_ENCONTRADO", "No se encontró el turno"],
      "errores.turno.cancelado": ["TURNO_CANCELADO", "El turno está cancelado"],
      "errores.turno.pendiente": ["TURNO_PENDIENTE", "El turno está pendiente: los alumnos se cargan desde la asignación de participantes"],
      "errores.turno.sinAula": ["TURNO_SIN_AULA", "El turno no tiene aula asignada"],
      "errores.turno.vencido": ["TURNO_VENCIDO", "El horario del turno ya pasó"],
    } as const;
    for (const [clave, [code, texto]] of Object.entries(sprint2) as [keyof typeof sprint2, readonly [string, string]][]) {
      expect(TEXTOS[clave], clave).toBe(texto);
      expect(ERRORES_DE_DOMINIO[clave].code, clave).toBe(code);
    }
  });
});

describe("códigos existentes y códigos nuevos (1.1)", () => {
  it("los code de los Sprints 1 y 2 están en el catálogo", () => {
    const codes = new Set(Object.values(ERRORES_DE_DOMINIO).map(({ code }) => code));
    for (const code of CODIGOS_SPRINTS_1_Y_2) expect(codes.has(code), code).toBe(true);
  });

  it("statusDeErrorNuevo: el HTTP del catálogo solo para un code nuevo; null para los existentes y otros errores", () => {
    expect(statusDeErrorNuevo(new ErrorDeDominio("errores.inscripcion.materiaSinTarifaCentro"))).toBe(422);
    expect(statusDeErrorNuevo(new ErrorDeDominio("errores.transaccion.ocupada"))).toBe(409);
    expect(statusDeErrorNuevo(new ErrorDeDominio("errores.alumno.noEncontrado"))).toBeNull();
    expect(statusDeErrorNuevo(new ErrorDeDominio("errores.turno.cupoInsuficiente"))).toBeNull();
    expect(statusDeErrorNuevo(new ServiceError("MATERIA_SIN_TARIFA"))).toBeNull();
    expect(statusDeErrorNuevo(new Error("x"))).toBeNull();
  });
});

describe("ErrorDeDominio", () => {
  it("extiende ServiceError con el code estable, el texto de la clave y los datos como detalles", () => {
    const error = new ErrorDeDominio("errores.transaccion.ocupada");
    expect(error).toBeInstanceOf(ServiceError);
    expect(error).toBeInstanceOf(ErrorDeDominio);
    expect(error.code).toBe("TRANSACCION_OCUPADA");
    expect(error.status).toBe(409);
    expect(error.codigo).toBe("errores.transaccion.ocupada");
    expect(error.message).toBe("Otra persona está modificando estos datos. Intentá de nuevo.");
    expect(error.name).toBe("ErrorDeDominio");
    expect(error.detalles).toBeUndefined();
  });

  it("completa los huecos del texto con los datos y los expone en detalles", () => {
    const error = new ErrorDeDominio("errores.profesor.conClasesFuturas", { total: 12, pendientes: 2 });
    expect(error.code).toBe("PROFESOR_CON_CLASES_FUTURAS");
    expect(error.message).toBe("No se puede desactivar: el profesor tiene 12 clases futuras");
    expect(error.detalles).toEqual({ total: 12, pendientes: 2 });
    expect(error.datos).toEqual({ total: 12, pendientes: 2 });
  });

  it("conserva el code de hoy cuando la condición ya existía (ALUMNO_NO_DISPONIBLE con alumno_id)", () => {
    const error = new ErrorDeDominio("errores.inscripcion.alumnoNoDisponible", { alumno_id: "a1" });
    expect(error.code).toBe("ALUMNO_NO_DISPONIBLE");
    expect(error.message).toBe("El alumno ya tiene un turno agendado en ese horario");
    expect(error.detalles).toEqual({ alumno_id: "a1" });
  });

  it("esErrorDeDominio distingue por clave", () => {
    const error = new ErrorDeDominio("errores.caja.sinCajaAbierta");
    expect(esErrorDeDominio(error)).toBe(true);
    expect(esErrorDeDominio(error, "errores.caja.sinCajaAbierta")).toBe(true);
    expect(esErrorDeDominio(error, "errores.transaccion.ocupada")).toBe(false);
    expect(esErrorDeDominio(new ServiceError("CAJA_NO_ABIERTA"))).toBe(false);
  });

  it("texto() deja tal cual un hueco sin valor", () => {
    expect(texto("errores.profesor.conClasesFuturas")).toContain("{total}");
    expect(texto("errores.profesor.conClasesFuturas", {})).toContain("{total}");
  });
});
