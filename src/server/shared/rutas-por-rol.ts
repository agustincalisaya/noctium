import type { RolUsuario } from "@prisma/client";

/**
 * Autorización por rol a nivel de ruta (src/proxy.ts). Reglas por primer
 * segmento de la URL, basadas en `SECCIONES_POR_ROL` de Sidebar.tsx (qué ve
 * cada rol) más las 4 pantallas principales por rol de HU-A-01
 * (mesa-entrada/profesor/gerente/alumno), que Sidebar.tsx no lista porque no
 * son ítems de navegación.
 *
 * "CUALQUIERA" = cualquier rol autenticado, sin restricción adicional acá
 * (la única condición es tener sesión válida, ya resuelta en src/proxy.ts
 * antes de llamar a `rolPuedeAccederRuta`).
 */
const RUTAS_POR_ROL: Record<string, readonly RolUsuario[] | "CUALQUIERA"> = {
  "mesa-entrada": ["MESA_ENTRADA"],
  profesor: ["PROFESOR"],
  gerente: ["GERENTE"],
  alumno: ["ALUMNO"],
  "mi-historial": ["ALUMNO"],
  profesores: ["MESA_ENTRADA", "GERENTE"],
  aulas: ["GERENTE"],
  alumnos: ["MESA_ENTRADA", "GERENTE"],
  pagos: ["MESA_ENTRADA"],
  materias: ["MESA_ENTRADA", "GERENTE", "PROFESOR"],
  turnos: "CUALQUIERA",
  calendario: "CUALQUIERA",
  home: "CUALQUIERA",
  // HU-A-06 (spec_modulo_A.md §2.8.2, P-A11): las dos pantallas de
  // contraseña son de los cuatro roles, con sesión.
  "primer-ingreso": "CUALQUIERA",
  "mi-cuenta": "CUALQUIERA",
};

/** Única página que admite una sesión con la marca «Debe cambiar la contraseña». */
export const RUTA_PRIMER_INGRESO = "/primer-ingreso";

/**
 * `true` si una sesión con la marca «Debe cambiar la contraseña» puede ver
 * `pathname` sin que src/proxy.ts la mande a `/primer-ingreso`
 * (spec_modulo_A.md §2.6.2). De las rutas que pasan por el proxy, solo
 * `/primer-ingreso`: el cierre de sesión (`/api/auth/logout`) y las rutas
 * públicas quedan fuera del `matcher`, así que nunca llegan acá. Compara por
 * segmento completo, igual que `rolPuedeAccederRuta`.
 */
export function rutaAdmiteMarca(pathname: string): boolean {
  return pathname.split("/").filter(Boolean)[0] === RUTA_PRIMER_INGRESO.slice(1);
}

/**
 * Compara por segmento completo, no por prefijo de string: `/aula/1` no debe
 * matchear la regla de `/aulas` (ni viceversa). Un segmento sin regla
 * explícita en el mapa no está gestionado por esta función — vuelve `true`
 * (no restringe); qué rutas pasan por acá lo decide el `matcher` de
 * src/proxy.ts, no este mapa.
 */
export function rolPuedeAccederRuta(rol: RolUsuario, pathname: string): boolean {
  const partes = pathname.split("/").filter(Boolean);
  const segmento = partes[0];
  if (segmento === "profesores" && rol === "GERENTE" &&
    (partes[1] === "nuevo" || partes[1] === "horarios" || partes.length > 2)) return false;
  if (!segmento) return true;

  const regla = RUTAS_POR_ROL[segmento];
  if (!regla) return true;
  if (regla === "CUALQUIERA") return true;

  return regla.includes(rol);
}
