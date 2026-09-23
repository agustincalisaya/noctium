import { redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { getParametroNumerico } from "@/server/shared/parametros";
import { fechaUTCHaceAnios } from "@/server/shared/fecha";
import { NuevoProfesorForm } from "./nuevo-profesor-form";

/**
 * Defensa en profundidad (HU-D-01 criterio de aceptación 5, "solo rol
 * Gerente puede acceder"): la superficie que realmente rechaza es el
 * servidor, en `crearProfesor()`/`verificarDniDisponible()` de
 * `../actions.ts` (ambas vuelven a llamar `verificarPermiso()`) — este
 * chequeo acá solo evita que un rol sin permiso vea el formulario montado
 * antes de intentar enviarlo, mismo criterio que ya usa
 * `app/(dashboard)/layout.tsx` con la sesión.
 */
export default async function NuevoProfesorPage() {
  try {
    await verificarPermiso("profesores:crear");
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect("/profesores");
    }
    throw error;
  }

  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);

  // Hoy en UTC (no hora local del servidor) menos 18 años exactos, mismo
  // límite que el refine de mayoría de edad en profesor.schema.ts (regla
  // agregada por decisión del usuario, ver "Desviaciones de la spec original"
  // en docs/tasks/Sprint 1/HU-D-01.md) — se resuelve acá, una sola vez por
  // request, y se pasa como prop en vez de recalcularse en el cliente (que
  // podría tener otro huso horario que el servidor).
  const fechaMaximaNacimiento = fechaUTCHaceAnios(18)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Nuevo profesor</h1>
      <NuevoProfesorForm
        dniLongitudMin={dniLongitudMin}
        dniLongitudMax={dniLongitudMax}
        fechaMaximaNacimiento={fechaMaximaNacimiento}
      />
    </div>
  );
}
