import { z } from "zod";
import type { Genero } from "@prisma/client";
import { texto } from "@/lib/textos";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha";
import { normalizarTextoNombre } from "@/server/shared/texto";

/**
 * Identidad de una persona (spec_modulo_F.md §1, «Utilidades compartidas
 * nuevas»): la definición de spec_modulo_D.md §2.1 sin el contacto. Pura y
 * sin estado, sin acoplamiento de dominio: la usan el personal de mesa de
 * entrada (HU-F-01) y los gerentes (HU-G-01). D y B conservan sus propios
 * schemas (no se refactorizan); a diferencia del de profesor, no exige
 * mayoría de edad, porque no lo piden el backlog ni la spec F.
 *
 * Los mensajes salen del archivo central de textos (DESIGN.md §9). Se importa
 * también desde el formulario (cliente): por eso el género es un arreglo de
 * constantes y no el enum de `@prisma/client` (mismo criterio que
 * `profesor.schema.ts`).
 */
export const GENERO_VALORES = ["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_INDICARLO"] as const satisfies Genero[];

const NOMBRE_REGEX = /^[\p{L}\s'-]+$/u;
const NOMBRE_LONGITUD_MIN = 2;
const NOMBRE_LONGITUD_MAX = 50;

/** Nombre o apellido: espacios colapsados (`normalizarTextoNombre`), 2 a 50 caracteres, letras, espacios, acentos, apóstrofes y guiones. */
function nombrePersonaSchema(mensajes: { requerido: string; minimo: string; maximo: string; caracteres: string }) {
  return z
    .string({ error: mensajes.requerido })
    .transform(normalizarTextoNombre)
    .pipe(
      z
        .string()
        .min(1, { error: mensajes.requerido, abort: true })
        .min(NOMBRE_LONGITUD_MIN, mensajes.minimo)
        .max(NOMBRE_LONGITUD_MAX, mensajes.maximo)
        .regex(NOMBRE_REGEX, mensajes.caracteres),
    );
}

/** Hoy a medianoche UTC: `fechaCalendarioValidaSchema` devuelve medianoche UTC, así se compara calendario contra calendario. */
function hoyUTC(): number {
  const ahora = new Date();
  return Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
}

/**
 * `dniLongitudMin` y `dniLongitudMax` salen de `ParametroSistema`
 * (`getParametroNumerico("dni_longitud_min" / "dni_longitud_max")`): quien
 * llama los resuelve antes, porque el schema es sincrónico y se usa igual en
 * el formulario, la Server Action y el Route Handler.
 */
export function construirIdentidadPersonaSchema(dniLongitudMin: number, dniLongitudMax: number) {
  const dniLongitud = texto("ui.comun.identidad.dniLongitud", { min: dniLongitudMin, max: dniLongitudMax });
  return z.object({
    nombre: nombrePersonaSchema({
      requerido: texto("ui.comun.identidad.nombreRequerido"),
      minimo: texto("ui.comun.identidad.nombreLongitudMinima"),
      maximo: texto("ui.comun.identidad.nombreLongitudMaxima"),
      caracteres: texto("ui.comun.identidad.nombreCaracteres"),
    }),
    apellido: nombrePersonaSchema({
      requerido: texto("ui.comun.identidad.apellidoRequerido"),
      minimo: texto("ui.comun.identidad.apellidoLongitudMinima"),
      maximo: texto("ui.comun.identidad.apellidoLongitudMaxima"),
      caracteres: texto("ui.comun.identidad.apellidoCaracteres"),
    }),
    dni: z
      .string({ error: texto("ui.comun.identidad.dniRequerido") })
      .trim()
      .min(1, { error: texto("ui.comun.identidad.dniRequerido"), abort: true })
      .regex(/^\d+$/, texto("ui.comun.identidad.dniSoloNumeros"))
      .min(dniLongitudMin, dniLongitud)
      .max(dniLongitudMax, dniLongitud),
    // Ausente o vacía: «Ingresá la fecha de nacimiento»; después, el formato y
    // la fecha real de `fechaCalendarioValidaSchema` (YYYY-MM-DD → Date UTC).
    fechaNacimiento: z
      .preprocess(
        (valor) => (valor == null ? "" : valor),
        z.string({ error: texto("ui.comun.identidad.fechaNacimientoRequerida") })
          .trim()
          .min(1, texto("ui.comun.identidad.fechaNacimientoRequerida"))
          .pipe(fechaCalendarioValidaSchema),
      )
      .refine((fecha) => fecha.getTime() <= hoyUTC(), texto("ui.comun.identidad.fechaNacimientoFutura")),
    genero: z.enum(GENERO_VALORES, { error: texto("ui.comun.identidad.generoInvalido") }).optional(),
  });
}

export type IdentidadPersonaInput = z.infer<ReturnType<typeof construirIdentidadPersonaSchema>>;
