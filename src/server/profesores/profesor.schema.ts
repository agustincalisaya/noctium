import { z } from "zod";
import type { Genero } from "@prisma/client";
import { fechaCalendarioValidaSchema, fechaUTCHaceAnios } from "@/server/shared/fecha";
import { normalizarTextoNombre } from "@/server/shared/texto";
import { ContactoSchema, type ContactoInput } from "@/server/shared/contacto.schema";
import {
  DIAS_SEMANA,
  HORA_REGEX,
  validarIntervaloHorario,
  type ParametrosHorarioOperativo,
} from "@/lib/horario-atencion";

const NOMBRE_REGEX = /^[\p{L}\s'-]+$/u;

// Duplicado a propósito como array de strings en vez de z.enum(Genero) con
// el valor real de @prisma/client — ver nota de deuda técnica en
// docs/tasks/Sprint 1/HU-D-01.md junto a §4.5 (restricción de bundling
// Prisma+Next.js: este schema también se importa desde un Client Component).
const GENERO_VALORES = ["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_INDICARLO"] as const satisfies Genero[];

function nombreSchema(etiqueta: string) {
  return z
    .string()
    .transform(normalizarTextoNombre)
    .pipe(
      z
        .string()
        .min(2, `${etiqueta} debe tener al menos 2 caracteres`)
        .max(50, `${etiqueta} no puede superar los 50 caracteres`)
        .regex(
          NOMBRE_REGEX,
          `${etiqueta} solo admite letras, espacios, acentos, apóstrofes y guiones`,
        ),
    );
}

/**
 * `dniLongitudMin`/`dniLongitudMax` se resuelven de forma async contra
 * `ParametroSistema` (`getParametroNumerico("dni_longitud_min", ...)` /
 * `getParametroNumerico("dni_longitud_max", ...)`, `src/server/shared/parametros.ts`)
 * ANTES de llamar a esta función — Zod no soporta un refine async ergonómico
 * en un schema sincrónico reutilizado tanto en cliente como en servidor, así
 * que el schema se construye ya parametrizado en lugar de resolverlo adentro.
 */
export function construirIdentidadProfesorSchema(
  dniLongitudMin: number,
  dniLongitudMax: number,
) {
  return z.object({
    nombre: nombreSchema("El nombre"),
    apellido: nombreSchema("El apellido"),
    dni: z
      .string()
      .trim()
      .regex(/^\d+$/, "Ingresá el DNI solo con números")
      .min(
        dniLongitudMin,
        `El DNI debe tener entre ${dniLongitudMin} y ${dniLongitudMax} dígitos`,
      )
      .max(
        dniLongitudMax,
        `El DNI debe tener entre ${dniLongitudMin} y ${dniLongitudMax} dígitos`,
      ),
    // Comparación contra "hoy" en UTC (no new Date() / hora local del
    // servidor): fechaCalendarioValidaSchema ya devuelve medianoche UTC, así
    // que el límite superior debe construirse con el mismo criterio para
    // comparar calendario contra calendario, no instante contra calendario.
    fechaNacimiento: fechaCalendarioValidaSchema
      .refine(
        (fecha) => fecha.getTime() <= Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
        "La fecha de nacimiento no puede ser futura",
      )
      // Mayoría de edad: regla de negocio agregada por decisión del usuario,
      // NO está en spec_modulo_D.md ni en los criterios de aceptación de
      // HU-D-01 — ver "Desviaciones de la spec original" en
      // docs/tasks/Sprint 1/HU-D-01.md.
      .refine(
        (fecha) => fecha.getTime() <= fechaUTCHaceAnios(18).getTime(),
        "El profesor debe ser mayor de edad (18 años cumplidos)",
      ),
    genero: z.enum(GENERO_VALORES).optional(),
  });
}

export type IdentidadProfesorInput = z.infer<
  ReturnType<typeof construirIdentidadProfesorSchema>
>;

/**
 * Contacto del profesor (HU-D-02): mismas reglas que el contacto de Alumno
 * (HU-B-02), así que se reutiliza el schema compartido en vez de duplicarlo
 * — utilidad de validación transversal, no acoplamiento de dominio.
 */
export const ContactoProfesorSchema = ContactoSchema;
export type ContactoProfesorInput = ContactoInput;

/**
 * Asociación de materias al profesor (HU-D-03, `spec_modulo_D.md` §2.3 con
 * nota de sincronización: camelCase y `z.cuid()` de Zod 4). El dedupe es
 * defensivo: la UI nunca envía un id dos veces, pero una llamada directa a
 * la API sí podría, y un id repetido haría fallar el `createMany` con P2002.
 */
export const AsociarMateriasProfesorSchema = z.object({
  materiaIds: z
    .array(z.cuid("Materia inválida"))
    .min(1, "Seleccioná al menos una materia nueva")
    .transform((ids) => [...new Set(ids)]),
});
export type AsociarMateriasProfesorInput = z.infer<typeof AsociarMateriasProfesorSchema>;

export const ProfesorIdSchema = z.cuid();

/**
 * Registro de horario de atención (HU-D-04, `spec_modulo_D.md` §2.4 con
 * camelCase, igual que HU-D-03). Mismo patrón que
 * `construirIdentidadProfesorSchema`: los parámetros operativos se leen de
 * `ParametroSistema` (`obtenerParametrosHorarioOperativo()`) antes de armar
 * el schema — en el servidor desde la base, en el cliente como props de la
 * página —, nunca se hardcodean en el formulario. Las reglas de día, franja
 * y granularidad son las de `validarIntervaloHorario()`, compartida con el
 * servicio. La superposición la valida solo el servicio (necesita la base).
 */
export function construirRegistrarHorarioSchema(parametros: ParametrosHorarioOperativo) {
  const horaSchema = (etiqueta: string) =>
    z
      .string({ error: `Seleccioná la hora de ${etiqueta}` })
      .min(1, `Seleccioná la hora de ${etiqueta}`)
      .regex(HORA_REGEX, `Ingresá la hora de ${etiqueta} en formato 24 h (HH:MM)`);

  return z
    .object({
      profesorId: z.cuid("Seleccioná un profesor"),
      diaSemana: z.enum(DIAS_SEMANA, { error: "Seleccioná un día" }),
      horaInicio: horaSchema("inicio"),
      horaFin: horaSchema("fin"),
    })
    .superRefine((datos, ctx) => {
      const error = validarIntervaloHorario(datos, parametros);
      if (error) ctx.addIssue({ code: "custom", message: error.mensaje, path: [error.campo] });
    });
}
export type RegistrarHorarioInput = z.infer<ReturnType<typeof construirRegistrarHorarioSchema>>;
