import { getParametroNumerico } from "@/server/shared/parametros";
import { RegistroForm } from "./registro-form";

// Sin auth()/cookies (a diferencia de NuevoAlumnoPage/EditarAlumnoPage, que
// son dinámicas por eso), Next.js prerenderizaría esta página en build time
// y horneraría los valores de ParametroSistema como constantes fijas — mal,
// porque están pensados como configurables en runtime. Fuerza renderizado
// dinámico para leerlos frescos en cada request.
export const dynamic = "force-dynamic";

/**
 * Autorregistro del alumno (HU-B-08, spec_modulo_B.md §2.6). Server
 * Component: resuelve los parámetros operativos que el formulario cliente
 * necesita (límites de validación + espera de reenvío) y se los pasa como
 * props — mismo patrón que `NuevoAlumnoPage`/`EditarAlumnoPage`
 * (`dni_longitud_min/max`), extendido acá a `password_longitud_minima` y
 * `reenvio_codigo_espera_segundos` para no duplicar esos valores a mano en
 * el cliente.
 */
export default async function RegistroPage() {
  const [dniLongitudMin, dniLongitudMax, passwordLongitudMinima, reenvioEsperaSegundos] =
    await Promise.all([
      getParametroNumerico("dni_longitud_min", 7),
      getParametroNumerico("dni_longitud_max", 8),
      getParametroNumerico("password_longitud_minima", 8),
      getParametroNumerico("reenvio_codigo_espera_segundos", 60),
    ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center p-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Crear cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Registrate para acceder a la plataforma sin depender de mesa de entrada.
        </p>
      </div>
      <RegistroForm
        dniLongitudMin={dniLongitudMin}
        dniLongitudMax={dniLongitudMax}
        passwordLongitudMinima={passwordLongitudMinima}
        reenvioEsperaSegundos={reenvioEsperaSegundos}
      />
    </main>
  );
}
