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
  profesores: ["MESA_ENTRADA"],
  aulas: ["GERENTE"],
  alumnos: ["MESA_ENTRADA", "GERENTE", "PROFESOR"],
  materias: ["MESA_ENTRADA", "GERENTE", "PROFESOR"],
  turnos: "CUALQUIERA",
  calendario: "CUALQUIERA",
  home: "CUALQUIERA",
};

/**
 * Compara por segmento completo, no por prefijo de string: `/aula/1` no debe
 * matchear la regla de `/aulas` (ni viceversa). Un segmento sin regla
 * explícita en el mapa no está gestionado por esta función — vuelve `true`
 * (no restringe); qué rutas pasan por acá lo decide el `matcher` de
 * src/proxy.ts, no este mapa.
 */
export function rolPuedeAccederRuta(rol: RolUsuario, pathname: string): boolean {
  const segmento = pathname.split("/").filter(Boolean)[0];
  if (!segmento) return true;

  const regla = RUTAS_POR_ROL[segmento];
  if (!regla) return true;
  if (regla === "CUALQUIERA") return true;

  return regla.includes(rol);
}
