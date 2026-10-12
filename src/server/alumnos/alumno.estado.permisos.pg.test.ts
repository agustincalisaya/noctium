import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";

// Permisos de HU-B-07 con la ruta REAL: `withPermission` (sesión, revocación,
// estado de la cuenta y RBAC contra la tabla `rol_permiso`), el servicio y la
// base PostgreSQL. Solo se simulan la cookie y el wrapper `auth` de NextAuth
// (la sesión del rol que se prueba). La matriz se comprueba con lo que dejan
// las migraciones y otra vez después de correr prisma/seed.ts completo.

const sesion = vi.hoisted(() => ({ actual: null as null | { id: string; rol: string } }));
vi.mock("@/auth", () => {
  const actual = () => (sesion.actual ? { user: { id: sesion.actual.id, rol: sesion.actual.rol } } : null);
  return {
    // `auth(handler)` envuelve una ruta; `auth()` lee la sesión (Server Components y actions).
    auth: (manejador?: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
      typeof manejador === "function"
        ? (req: NextRequest, ctx: unknown) => manejador(Object.assign(req, { auth: actual() }), ctx)
        : Promise.resolve(actual()),
    decodificarToken: async () => (sesion.actual ? { iat_sesion: Math.floor(Date.now() / 1000) } : null),
  };
});
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token-de-prueba" }) }) }));

const ROLES = ["MESA_ENTRADA", "GERENTE", "PROFESOR", "ALUMNO"] as const;
type Rol = (typeof ROLES)[number];

type Manejador = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
const rutas = {
  impacto: (await import("@/app/api/alumnos/[id]/impacto-baja/route")).GET as unknown as Manejador,
  desactivar: (await import("@/app/api/alumnos/[id]/desactivar/route")).POST as unknown as Manejador,
  reactivar: (await import("@/app/api/alumnos/[id]/reactivar/route")).POST as unknown as Manejador,
  detalle: (await import("@/app/api/alumnos/[id]/route")).GET as unknown as Manejador,
};

describe.skipIf(!basePgHabilitada)("HU-B-07: permisos de la baja y la reactivación, ruta real contra PostgreSQL", () => {
  let db: PrismaClient;
  const usuarios = new Map<Rol, string>();

  const matriz = async () => (await db.rolPermiso.findMany({ select: { rolPermiso: true, accionPermiso: true } }))
    .map((fila) => `${fila.accionPermiso} <- ${fila.rolPermiso}`).sort();
  const filasDe = (todas: string[], prefijo: string) => todas.filter((fila) => fila.startsWith(prefijo));

  async function llamar(ruta: keyof typeof rutas, rol: Rol | null, alumnoId: string, cuerpo?: unknown) {
    sesion.actual = rol ? { id: usuarios.get(rol)!, rol } : null;
    try {
      const respuesta = await rutas[ruta](
        new NextRequest(`http://localhost/api/alumnos/${alumnoId}`, cuerpo === undefined ? undefined : { method: "POST", body: JSON.stringify(cuerpo) }),
        { params: Promise.resolve({ id: alumnoId }) },
      );
      return { status: respuesta.status, cuerpo: await respuesta.json() };
    } finally { sesion.actual = null; }
  }
  const ficha = (id: string) => db.alumno.findUniqueOrThrow({ where: { idAlumno: id } });

  /** Los cuatro roles contra las tres rutas de estado: 200 solo para Mesa de Entrada, 403 SIN_PERMISO para el resto. */
  async function verificarRutasPorRol() {
    const activo = await crearAlumnoDePrueba(db);
    const inactivo = await crearAlumnoDePrueba(db, { activo: false });
    const SIN_PERMISO = { status: 403, cuerpo: { data: null, error: { code: "SIN_PERMISO", message: expect.any(String) } } };

    for (const rol of ROLES.filter((r) => r !== "MESA_ENTRADA")) {
      expect(await llamar("impacto", rol, activo.idAlumno), `impacto-baja como ${rol}`).toEqual(SIN_PERMISO);
      expect(await llamar("desactivar", rol, activo.idAlumno, { version: 0 }), `desactivar como ${rol}`).toEqual(SIN_PERMISO);
      expect(await llamar("reactivar", rol, inactivo.idAlumno, { version: 0 }), `reactivar como ${rol}`).toEqual(SIN_PERMISO);
    }
    // Ninguna de las escrituras rechazadas dejó huella.
    expect(await ficha(activo.idAlumno)).toMatchObject({ activoAlumno: true, version: 0 });
    expect(await ficha(inactivo.idAlumno)).toMatchObject({ activoAlumno: false, version: 0 });
    expect(await db.historialEstado.count({ where: { entidadId: { in: [activo.idAlumno, inactivo.idAlumno] } } })).toBe(0);

    const impacto = await llamar("impacto", "MESA_ENTRADA", activo.idAlumno);
    expect(impacto).toMatchObject({ status: 200, cuerpo: { data: { total: 0, version: 0 }, error: null } });
    const baja = await llamar("desactivar", "MESA_ENTRADA", activo.idAlumno, { version: 0 });
    expect(baja).toMatchObject({ status: 200, cuerpo: { data: { id: activo.idAlumno, activo: false, version: 1 }, error: null } });
    const alta = await llamar("reactivar", "MESA_ENTRADA", inactivo.idAlumno, { version: 0 });
    expect(alta).toMatchObject({ status: 200, cuerpo: { data: { id: inactivo.idAlumno, activo: true, version: 1 }, error: null } });
    expect(await ficha(activo.idAlumno)).toMatchObject({ activoAlumno: false, modificadoPorUsuarioId: usuarios.get("MESA_ENTRADA") });

    // `alumnos:leer` abre la ficha a Mesa y Gerente, pero no habilita ninguna escritura.
    for (const rol of ["MESA_ENTRADA", "GERENTE"] as const) {
      const lectura = await llamar("detalle", rol, activo.idAlumno);
      expect(lectura.status, `ficha como ${rol}`).toBe(200);
      expect(lectura.cuerpo.data.historial_estados).toEqual([expect.objectContaining({ accion: "DESACTIVAR" })]);
    }
    for (const rol of ["PROFESOR", "ALUMNO"] as const) expect((await llamar("detalle", rol, activo.idAlumno)).status, `ficha como ${rol}`).toBe(403);
    expect(await llamar("desactivar", null, activo.idAlumno, { version: 1 })).toMatchObject({ status: 401, cuerpo: { error: { code: "SESION_INVALIDA" } } });
  }

  beforeAll(async () => {
    db = clientePg();
    for (const rol of ROLES) usuarios.set(rol, (await crearUsuarioDePrueba(db, { rol })).idUsuario);
  });
  afterAll(async () => { await db?.$disconnect(); });

  let matrizDeMigraciones: string[] = [];

  it("con la base recién migrada, sin seed: alumnos:cambiar_estado es solo de Mesa de Entrada y las tres rutas responden 200 / 403 según el rol", async () => {
    matrizDeMigraciones = await matriz();
    expect(filasDe(matrizDeMigraciones, "alumnos:cambiar_estado")).toEqual(["alumnos:cambiar_estado <- MESA_ENTRADA"]);
    expect(filasDe(matrizDeMigraciones, "alumnos:leer")).toEqual(["alumnos:leer <- GERENTE", "alumnos:leer <- MESA_ENTRADA"]);
    await verificarRutasPorRol();
  });

  it("después de correr prisma/seed.ts completo: la matriz es exactamente la de las migraciones y las rutas siguen respondiendo igual", async () => {
    execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
      env: { ...process.env, SEED_FECHA_HOY: "2026-10-11" }, timeout: 180_000, encoding: "utf8", stdio: "pipe",
    });
    const despuesDelSeed = await matriz();
    expect(despuesDelSeed).toEqual(matrizDeMigraciones);
    expect(filasDe(despuesDelSeed, "alumnos:cambiar_estado")).toEqual(["alumnos:cambiar_estado <- MESA_ENTRADA"]);
    await verificarRutasPorRol();
  }, 300_000);
});
