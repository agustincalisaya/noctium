import type { ClasePendienteDePago } from "@/types/pago.types";

/**
 * Estado del paso 2 de «Registrar pago» (HU-I-10) y las cuentas que dependen
 * de él. Funciones puras: el wizard y los pasos las comparten y se prueban
 * sin React. El precio lo pone el servidor; acá solo se arma el importe.
 */

export type FilaElegible = {
  elegida: boolean;
  /** «Modificar importe» abierto: rige `monto` y, si difiere del precio, `motivo`. */
  modificando: boolean;
  monto: string;
  motivo: string;
};

export type Seleccion = Record<string, FilaElegible>;
export type ErroresDeFila = { monto?: "invalido"; motivo?: "requerido" };

const MONTO = /^\d{1,9}(\.\d{1,2})?$/;

export const claveDeClase = (clase: Pick<ClasePendienteDePago, "inscripcion_id" | "turno_id">) =>
  clase.inscripcion_id ?? `T:${clase.turno_id}`;

export function seleccionInicial(clases: ClasePendienteDePago[]): Seleccion {
  return Object.fromEntries(clases.map((clase) => [claveDeClase(clase), {
    elegida: clase.marcada, modificando: false, monto: String(clase.precio), motivo: "",
  }]));
}

/** Importe que se cobra de la clase, como texto (el del body); `null` si el importe modificado no es válido. */
export function importeDeFila(clase: ClasePendienteDePago, fila: FilaElegible | undefined): string | null {
  if (!fila?.modificando) return String(clase.precio);
  const monto = fila.monto.trim();
  return MONTO.test(monto) && Number(monto) > 0 ? monto : null;
}

const difiereDelPrecio = (importe: string, precio: number) => Number(importe) !== precio;

export function clasesElegidas(clases: ClasePendienteDePago[], seleccion: Seleccion): ClasePendienteDePago[] {
  return clases.filter((clase) => seleccion[claveDeClase(clase)]?.elegida);
}

/** Suma de los importes de las clases elegidas (un importe inválido no suma). */
export function totalElegido(clases: ClasePendienteDePago[], seleccion: Seleccion): number {
  return clasesElegidas(clases, seleccion)
    .reduce((suma, clase) => suma + Number(importeDeFila(clase, seleccion[claveDeClase(clase)]) ?? 0), 0);
}

/** Errores de las clases elegidas: importe inválido o importe distinto del precio sin motivo. */
export function erroresDeSeleccion(clases: ClasePendienteDePago[], seleccion: Seleccion): Record<string, ErroresDeFila> {
  const errores: Record<string, ErroresDeFila> = {};
  for (const clase of clasesElegidas(clases, seleccion)) {
    const clave = claveDeClase(clase);
    const fila = seleccion[clave]!;
    const importe = importeDeFila(clase, fila);
    if (importe === null) errores[clave] = { monto: "invalido" };
    else if (difiereDelPrecio(importe, clase.precio) && !fila.motivo.trim()) errores[clave] = { motivo: "requerido" };
  }
  return errores;
}

/** Ítems del body de POST /api/pagos/operaciones; el motivo solo viaja si el importe difiere del precio. */
export function itemsDeOperacion(clases: ClasePendienteDePago[], seleccion: Seleccion) {
  return clasesElegidas(clases, seleccion).map((clase) => {
    const fila = seleccion[claveDeClase(clase)]!;
    const monto = importeDeFila(clase, fila) ?? String(clase.precio);
    return {
      ...(clase.inscripcion_id ? { inscripcion_id: clase.inscripcion_id } : { turno_id: clase.turno_id }),
      monto,
      ...(difiereDelPrecio(monto, clase.precio) ? { motivo_ajuste: fila.motivo.trim() } : {}),
    };
  });
}

/** Motivo a mostrar en la confirmación: solo si el importe difiere del precio. */
export function motivoDeFila(clase: ClasePendienteDePago, fila: FilaElegible | undefined): string | null {
  const importe = importeDeFila(clase, fila);
  return importe !== null && difiereDelPrecio(importe, clase.precio) ? fila?.motivo.trim() || null : null;
}
