import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TEXTOS, texto } from "@/lib/textos";
import { ERRORES_DE_DOMINIO } from "@/server/shared/errores-dominio";
import { ErrorDeDominio, esErrorDeDominio } from "@/server/shared/error-dominio";
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

  it("los errores de inscripción que ya existían conservan code y texto de turno.service (1.1)", () => {
    const servicio = readFileSync(join(SRC, "server/turnos/turno.service.ts"), "utf8");
    for (const clave of [
      "errores.turno.cupoInsuficiente", "errores.alumno.inactivo", "errores.alumno.inactivoPropio",
      "errores.inscripcion.alumnoYaAsignado", "errores.inscripcion.alumnoYaAsignadoPropio",
    ] as const) {
      expect(servicio, clave).toContain(TEXTOS[clave]);
      expect(servicio, clave).toContain(ERRORES_DE_DOMINIO[clave].code);
    }
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
