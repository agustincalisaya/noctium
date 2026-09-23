import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { withPermission } from "@/server/shared/with-permission";
import { getParametroNumerico } from "@/server/shared/parametros";
import {
  construirIdentidadProfesorSchema,
  ListarProfesoresQuerySchema,
} from "@/server/profesores/profesor.schema";
import { crearProfesor, listarProfesores } from "@/server/profesores/profesor.service";
import { ServiceError } from "@/server/shared/service-error";

// Listado paginado de profesores (HU-D-05, spec_modulo_D.md §2.5). Capa
// delgada: valida `?pagina=&por_pagina=` con Zod e invoca listarProfesores(),
// el mismo servicio que usa la página /profesores.
export const GET = withPermission("profesores:leer", async (req) => {
  const parsed = ListarProfesoresQuerySchema.safeParse({
    pagina: req.nextUrl.searchParams.get("pagina") ?? undefined,
    por_pagina: req.nextUrl.searchParams.get("por_pagina") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDACION",
          message: "Parámetros inválidos",
          campos: flattenError(parsed.error).fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  try {
    const data = await listarProfesores(parsed.data);
    return NextResponse.json({ data, error: null }, { status: 200 });
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } },
      { status: 500 },
    );
  }
});

// Alta de identidad de profesor (HU-D-01, spec_modulo_D.md §2.1). Capa
// delgada (Regla N.° 4 de docs/RULES.md): valida el body con Zod, invoca
// crearProfesor() de profesor.service.ts y traduce el resultado al
// contrato { data, error } (Regla N.° 5) — ninguna lógica de negocio vive
// acá, mismo servicio que ya usa la Server Action equivalente en
// app/(dashboard)/profesores/actions.ts.
//
// withPermission() (no verificarPermiso()): esta es la superficie Route
// Handler, la única que además renueva la cookie de sesión al pasar por
// auth(handler) — ver el docstring de with-permission.ts.
export const POST = withPermission("profesores:crear", async (req) => {
  // withPermission ya devolvió 401/403 antes de invocar este handler si no
  // había sesión válida con el permiso — para acá, req.auth.user siempre
  // está presente.
  const usuarioRegistranteId = req.auth!.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: { code: "BODY_INVALIDO", message: "El cuerpo de la solicitud debe ser JSON válido" },
      },
      { status: 400 },
    );
  }

  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);

  const parsed = construirIdentidadProfesorSchema(dniLongitudMin, dniLongitudMax).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDACION",
          message: "Datos inválidos",
          campos: flattenError(parsed.error).fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  try {
    const profesor = await crearProfesor(parsed.data, usuarioRegistranteId);
    return NextResponse.json({ data: profesor, error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError && error.code === "DNI_DUPLICADO") {
      return NextResponse.json(
        {
          data: null,
          error: { code: "DNI_DUPLICADO", message: "Ya existe un profesor registrado con ese DNI" },
        },
        { status: 409 },
      );
    }
    // Cualquier otro error (ServiceError no traducido, falla de conexión a
    // la base, excepción inesperada): nunca un detalle técnico en el body
    // ("Definiciones generales" de Sprint 1, mismo criterio que
    // app/(dashboard)/profesores/actions.ts).
    return NextResponse.json(
      { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } },
      { status: 500 },
    );
  }
});
